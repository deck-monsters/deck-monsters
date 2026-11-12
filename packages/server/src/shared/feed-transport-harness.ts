/**
 * Test harness for the real-transport suite (`trpc/ring-feed-transport.pg.test.ts`,
 * roadmap 52 D4): a fault-injecting TCP proxy, a test JWT issuer for the server's own auth
 * path, a real in-process Fastify + tRPC WebSocket server, and a client built from the app's
 * own `createWSClient` options. Nothing here ships: it is only imported by tests.
 */
import { createServer, Socket, type Server } from 'node:net';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ws from '@fastify/websocket';
import { createTRPCClient, createWSClient, wsLink } from '@trpc/client';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify, { type FastifyInstance } from 'fastify';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK, type KeyLike } from 'jose';

import type { ChatService } from '../chat/chat-service.js';
import { createFastifyOptions } from '../fastify-options.js';
import type { RoomManager } from '../room-manager.js';
import { _setJWKSOverride, createContext } from '../trpc/context.js';
import { createRouter } from '../trpc/router.js';

export type AppRouterType = ReturnType<typeof createRouter>;

// ---------------------------------------------------------------------------
// Waiting
// ---------------------------------------------------------------------------

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls `fn` until it returns something truthy. For state that has no event to await (a DB count). */
export async function poll<T>(fn: () => Promise<T | undefined | false> | T | undefined | false, timeoutMs: number, label: string, everyMs = 25): Promise<T> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const value = await fn();
		if (value) return value;
		if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs} ms waiting for ${label}`);
		await sleep(everyMs);
	}
}

/** Blocks until the wall clock is in a later millisecond, so two ids can never share one. */
export function nextMillisecond(): void {
	const start = Date.now();
	while (Date.now() <= start) {
		/* spin: at most 1 ms */
	}
}

// ---------------------------------------------------------------------------
// WebSocket frame parsing (for the proxy's eyes only)
// ---------------------------------------------------------------------------

/**
 * Reads the text frames out of one direction of a WebSocket byte stream. The proxy uses it to
 * see what the real client sends (`PING`, the subscription message and its `lastEventId`) and
 * what the real server answers (`PONG`). Client frames are masked, server frames are not.
 * It skips the HTTP upgrade that precedes the frames and does not handle fragmented messages
 * (tRPC sends none).
 */
class TextFrameReader {
	private buf = Buffer.alloc(0);
	private inHttp = true;

	constructor(private readonly onText: (text: string) => void) {}

	feed(chunk: Buffer): void {
		this.buf = Buffer.concat([this.buf, chunk]);
		if (this.inHttp) {
			const end = this.buf.indexOf('\r\n\r\n');
			if (end === -1) return;
			this.buf = this.buf.subarray(end + 4);
			this.inHttp = false;
		}
		for (;;) {
			if (this.buf.length < 2) return;
			const opcode = this.buf[0]! & 0x0f;
			const masked = (this.buf[1]! & 0x80) !== 0;
			let len = this.buf[1]! & 0x7f;
			let off = 2;
			if (len === 126) {
				if (this.buf.length < 4) return;
				len = this.buf.readUInt16BE(2);
				off = 4;
			} else if (len === 127) {
				if (this.buf.length < 10) return;
				len = Number(this.buf.readBigUInt64BE(2));
				off = 10;
			}
			const maskKey = masked ? this.buf.subarray(off, off + 4) : null;
			if (masked) off += 4;
			if (this.buf.length < off + len) return;
			const payload = Buffer.from(this.buf.subarray(off, off + len));
			if (maskKey) for (let i = 0; i < payload.length; i++) payload[i] = payload[i]! ^ maskKey[i % 4]!;
			this.buf = this.buf.subarray(off + len);
			if (opcode === 1) this.onText(payload.toString('utf8'));
		}
	}
}

// ---------------------------------------------------------------------------
// Fault-injecting TCP proxy
// ---------------------------------------------------------------------------

/**
 * `pass` forwards. `refuse` accepts and immediately resets new connections (a server that is
 * down). `blackhole` accepts and silently drops everything in both directions without closing
 * anything (a phone that left the network, a NAT that forgot the flow): the sockets stay open
 * on both ends and nothing is ever delivered.
 */
export type ProxyMode = 'pass' | 'refuse' | 'blackhole';

type Pipe = { client: Socket; upstream: Socket | null };

export class FaultProxy {
	private readonly server: Server;
	private readonly pipes = new Set<Pipe>();
	mode: ProxyMode = 'pass';
	port = 0;
	/** Connections accepted since the proxy started (a reconnect is one more). */
	accepted = 0;
	/** Connections reset on arrival because the mode was `refuse` (failed reconnect attempts). */
	refused = 0;
	/** `Date.now()` and mode of every accepted connection. */
	readonly acceptLog: Array<{ at: number; mode: ProxyMode }> = [];
	/** Every text frame the client sent, in order, with whether the proxy let it through. */
	readonly clientFrames: Array<{ at: number; text: string; delivered: boolean }> = [];
	/** Every text frame the server sent that the proxy forwarded (PONG, data). */
	readonly serverFrames: Array<{ at: number; text: string }> = [];

	constructor(private readonly upstreamPort: number) {
		this.server = createServer((client) => this.onConnection(client));
	}

	async listen(): Promise<void> {
		await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
		const addr = this.server.address();
		this.port = typeof addr === 'object' && addr ? addr.port : 0;
	}

	async close(): Promise<void> {
		this.destroyAll();
		await new Promise<void>((resolve) => this.server.close(() => resolve()));
	}

	/** The subscription messages the client has sent (parsed), oldest first. */
	subscriptionMessages(): Array<{ at: number; delivered: boolean; id: number; params: { input?: unknown; path?: string; lastEventId?: string } }> {
		const out: Array<{ at: number; delivered: boolean; id: number; params: { input?: unknown; path?: string; lastEventId?: string } }> = [];
		for (const frame of this.clientFrames) {
			if (frame.text === 'PING') continue;
			let parsed: unknown;
			try {
				parsed = JSON.parse(frame.text);
			} catch {
				continue;
			}
			for (const msg of Array.isArray(parsed) ? parsed : [parsed]) {
				const m = msg as { id?: number; method?: string; params?: { input?: unknown; path?: string; lastEventId?: string } };
				if (m.method === 'subscription' && m.params) out.push({ at: frame.at, delivered: frame.delivered, id: m.id as number, params: m.params });
			}
		}
		return out;
	}

	count(kind: 'PING' | 'PONG'): number {
		return kind === 'PING'
			? this.clientFrames.filter((f) => f.text === 'PING').length
			: this.serverFrames.filter((f) => f.text === 'PONG').length;
	}

	/** Resets every open connection from both ends: the server's TCP connection dies. */
	destroyAll(): void {
		for (const pipe of this.pipes) {
			pipe.client.resetAndDestroy();
			pipe.upstream?.resetAndDestroy();
		}
		this.pipes.clear();
	}

	/**
	 * Changes the mode. Leaving `blackhole` resets every connection that lived through it: a
	 * byte stream with a hole in it cannot be resumed, so a real network would have reset it
	 * too, and the client's next attempt must be a new connection.
	 */
	setMode(mode: ProxyMode): void {
		const was = this.mode;
		this.mode = mode;
		if (was === 'blackhole' && mode !== 'blackhole') this.destroyAll();
	}

	private onConnection(client: Socket): void {
		this.accepted += 1;
		this.acceptLog.push({ at: Date.now(), mode: this.mode });
		client.on('error', () => {});
		if (this.mode === 'refuse') {
			this.refused += 1;
			client.resetAndDestroy();
			return;
		}
		const pipe: Pipe = { client, upstream: null };
		this.pipes.add(pipe);
		const clientReader = new TextFrameReader((text) => {
			this.clientFrames.push({ at: Date.now(), text, delivered: this.mode === 'pass' });
		});
		client.on('data', (chunk) => {
			clientReader.feed(chunk);
			if (this.mode === 'pass') pipe.upstream?.write(chunk);
		});
		client.on('close', () => {
			this.pipes.delete(pipe);
			pipe.upstream?.destroy();
		});
		if (this.mode === 'blackhole') return; // swallowed: no upstream, no answer

		const upstream = new Socket();
		pipe.upstream = upstream;
		upstream.on('error', () => {});
		const serverReader = new TextFrameReader((text) => {
			this.serverFrames.push({ at: Date.now(), text });
		});
		upstream.on('data', (chunk) => {
			if (this.mode !== 'pass') return; // dropped: the black hole eats the server's frames too
			serverReader.feed(chunk);
			client.write(chunk);
		});
		upstream.on('close', () => {
			if (this.mode === 'pass') client.destroy();
		});
		upstream.connect(this.upstreamPort, '127.0.0.1');
	}
}

// ---------------------------------------------------------------------------
// Auth: a real signed JWT, verified by the server's own createContext
// ---------------------------------------------------------------------------

export const TEST_SUPABASE_URL = 'http://supabase.feed-transport.test';

/**
 * Makes `createContext` (trpc/context.ts) trust a locally generated key instead of fetching
 * Supabase's JWKS. Uses the seam context.ts already exports (`_setJWKSOverride`) plus
 * `SUPABASE_URL`; the token still goes through jose's signature, issuer, audience and expiry
 * checks, so a connection is authenticated exactly as in production.
 */
export async function installTestAuth(): Promise<{ signToken: (userId: string) => Promise<string>; restore: () => void }> {
	const { publicKey, privateKey } = await generateKeyPair('ES256');
	const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'feed-transport-test', alg: 'ES256', use: 'sig' };
	const previousUrl = process.env['SUPABASE_URL'];
	process.env['SUPABASE_URL'] = TEST_SUPABASE_URL;
	_setJWKSOverride(createLocalJWKSet({ keys: [jwk] }) as never);
	return {
		signToken: (userId: string) =>
			new SignJWT({})
				.setProtectedHeader({ alg: 'ES256', kid: 'feed-transport-test' })
				.setSubject(userId)
				.setAudience('authenticated')
				.setIssuer(`${TEST_SUPABASE_URL}/auth/v1`)
				.setIssuedAt()
				.setExpirationTime('2h')
				.sign(privateKey as KeyLike),
		restore: () => {
			_setJWKSOverride(null);
			if (previousUrl === undefined) delete process.env['SUPABASE_URL'];
			else process.env['SUPABASE_URL'] = previousUrl;
		},
	};
}

// ---------------------------------------------------------------------------
// The real server
// ---------------------------------------------------------------------------

export type RealServer = { fastify: FastifyInstance; port: number; close: () => Promise<void> };

/**
 * Fastify with the same WebSocket and tRPC registration as `index.ts` (`useWSS: true`, the real
 * `createContext`), the real router and the given RoomManager. Keep in step with index.ts.
 */
export async function startRealServer(roomManager: RoomManager, chat: ChatService): Promise<RealServer> {
	const fastify = Fastify(createFastifyOptions('silent'));
	await fastify.register(ws);
	await fastify.register(fastifyTRPCPlugin, {
		prefix: '/trpc',
		useWSS: true,
		trpcOptions: { router: createRouter(roomManager, chat), createContext },
	});
	await fastify.listen({ port: 0, host: '127.0.0.1' });
	const addr = fastify.server.address();
	const port = typeof addr === 'object' && addr ? addr.port : 0;
	return { fastify, port, close: () => fastify.close() };
}

// ---------------------------------------------------------------------------
// The client: the app's own WebSocket options on the real @trpc/client
// ---------------------------------------------------------------------------

/**
 * Imports the options the web app builds its `createWSClient` from. It is a dynamic import by
 * file URL because the web app is outside this package's `rootDir`; `tsx` runs the .ts file
 * as it is. If the app changes its keep-alive or lazy settings, this suite runs with them.
 */
async function loadAppWsOptions(): Promise<(url: () => string) => Parameters<typeof createWSClient>[0]> {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const file = path.resolve(here, '../../../../apps/web/src/lib/ws-client-options.ts');
	const mod = (await import(pathToFileURL(file).href)) as {
		ringFeedWsClientOptions: (url: () => string) => Parameters<typeof createWSClient>[0];
	};
	return mod.ringFeedWsClientOptions;
}

/** The pure timing helpers the app's feed hook uses (`utils/ring-feed-connection.ts`): its backoff and watchdog. */
export async function loadAppFeedConnection(): Promise<{
	reconnectDelayMs: (failures: number, random?: () => number) => number;
	HEARTBEAT_TIMEOUT_MS: number;
}> {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const file = path.resolve(here, '../../../../apps/web/src/utils/ring-feed-connection.ts');
	return (await import(pathToFileURL(file).href)) as never;
}

export type RingFeedInput = { roomId: string; lastEventId?: string; resumeAttempt?: number };

export type SeenFrame = {
	/** Arrival time (ms, Date.now()). */
	at: number;
	/** tRPC's tracked id, or the untracked chat frame's own id. */
	id: string;
	/** `chat` for an untracked chat frame, otherwise the GameEvent type (`handshake`, `heartbeat`, `announce`, ...). */
	type: string;
	text: string;
	payload: unknown;
	/** Which `subscribe` call it came through (1-based, in call order). */
	sub: number;
};

export type ConnectionLogEntry = { at: number; state: string };

export class FeedClient {
	readonly frames: SeenFrame[] = [];
	readonly stateLog: ConnectionLogEntry[] = [];
	opens = 0;
	closes = 0;
	/** `Date.now()` of every `close()` the client called on a socket (the keep-alive's pong timeout does this). */
	readonly closeCalls: number[] = [];
	/** Every socket the client opened, so a test can read its readyState. */
	readonly sockets: WebSocket[] = [];
	/** Subscription errors the client surfaced (the app's hook treats each as a lost connection). */
	readonly errors: Array<{ at: number; sub: number; message: string }> = [];
	private readonly listeners = new Set<() => void>();
	private subCount = 0;
	private readonly wsClient: ReturnType<typeof createWSClient>;
	private readonly client: ReturnType<typeof createTRPCClient<AppRouterType>>;
	private readonly stateSub: { unsubscribe: () => void };

	private constructor(url: () => string, options: (url: () => string) => Parameters<typeof createWSClient>[0]) {
		const closeCalls = this.closeCalls;
		const sockets = this.sockets;
		const notify = () => this.notify();
		// Node's own WebSocket (what a browser's is to the app), with its calls recorded.
		class RecordingWebSocket extends WebSocket {
			constructor(target: string | URL) {
				super(target);
				sockets.push(this);
			}
			override close(code?: number, reason?: string): void {
				closeCalls.push(Date.now());
				super.close(code, reason);
				notify();
			}
		}
		this.wsClient = createWSClient({
			...options(url),
			WebSocket: RecordingWebSocket as never,
			onOpen: () => {
				this.opens += 1;
				this.notify();
			},
			onClose: () => {
				this.closes += 1;
				this.notify();
			},
		});
		this.client = createTRPCClient<AppRouterType>({ links: [wsLink({ client: this.wsClient })] });
		this.stateSub = this.wsClient.connectionState.subscribe({
			next: (s: { state: string }) => {
				this.stateLog.push({ at: Date.now(), state: s.state });
				this.notify();
			},
		});
	}

	static async create(url: () => string): Promise<FeedClient> {
		return new FeedClient(url, await loadAppWsOptions());
	}

	private notify(): void {
		for (const l of [...this.listeners]) l();
	}

	/** Subscribes to `game.ringFeed` exactly as the app's hook does. Returns the unsubscribe. */
	subscribe(input: RingFeedInput, onError?: (message: string) => void): () => void {
		const sub = ++this.subCount;
		const subscription = this.client.game.ringFeed.subscribe(input, {
			onData: (value: unknown) => {
				const v = value as { id: string; data?: { type: string; text: string; payload: unknown }; type?: string; payload?: unknown };
				if (v.data) {
					this.frames.push({ at: Date.now(), id: v.id, type: v.data.type, text: v.data.text, payload: v.data.payload, sub });
				} else {
					this.frames.push({ at: Date.now(), id: v.id, type: v.type ?? 'unknown', text: '', payload: v.payload, sub });
				}
				this.notify();
			},
			onError: (err: { message?: string }) => {
				this.errors.push({ at: Date.now(), sub, message: String(err?.message ?? err) });
				onError?.(String(err?.message ?? err));
				this.notify();
			},
		});
		return () => subscription.unsubscribe();
	}

	/** Resolves with the first truthy result of `fn`, re-checked on every frame, state change and socket event. */
	waitFor<T>(fn: () => T | undefined | false, timeoutMs: number, label: string): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const check = () => {
				const v = fn();
				if (v) {
					cleanup();
					resolve(v);
				}
			};
			const timer = setTimeout(() => {
				cleanup();
				reject(new Error(`timed out after ${timeoutMs} ms waiting for ${label}; frames so far: ${this.frames.map((f) => `${f.type}:${f.text || f.id}`).slice(-12).join(', ')}; states: ${this.stateLog.map((s) => s.state).join('>')}`));
			}, timeoutMs);
			const cleanup = () => {
				clearTimeout(timer);
				this.listeners.delete(check);
			};
			this.listeners.add(check);
			check();
		});
	}

	/** The announce events whose text starts with `evt-`, in arrival order (all copies). */
	eventTexts(): string[] {
		return this.frames.filter((f) => f.type === 'announce' && f.text.startsWith('evt-')).map((f) => f.text);
	}

	/** What the panes keep: first copy of each event id, in first-seen order. */
	dedupedEventTexts(): string[] {
		const seen = new Set<string>();
		const out: string[] = [];
		for (const f of this.frames) {
			if (f.type !== 'announce' || !f.text.startsWith('evt-') || seen.has(f.id)) continue;
			seen.add(f.id);
			out.push(f.text);
		}
		return out;
	}

	close(): void {
		this.stateSub.unsubscribe();
		this.wsClient.close();
	}
}
