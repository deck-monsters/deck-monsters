import { expect } from 'chai';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

import { createFastifyOptions, FASTIFY_MAX_PARAM_LENGTH } from './fastify-options.js';

/**
 * Builds a path like the web Terminal's room-mount batch:
 * room.info,game.ringHistory,game.recentFights,game.ringState,
 * game.consoleHistory,game.pendingPrompt,game.myMonsters (~114 chars).
 *
 * Hardcoded on purpose: documents the production path that crossed Fastify's
 * default maxParamLength. An 8th room-mount query won't auto-update this list;
 * headroom vs 5000 makes that low risk.
 */
function terminalBatchPath(): string {
	return [
		'room.info',
		'game.ringHistory',
		'game.recentFights',
		'game.ringState',
		'game.consoleHistory',
		'game.pendingPrompt',
		'game.myMonsters',
	].join(',');
}

function buildMiniRouter() {
	const t = initTRPC.create();
	const roomInput = z.object({ roomId: z.string() });
	const stub = t.procedure.input(roomInput).query(({ input }) => ({ ok: true, roomId: input.roomId }));
	return t.router({
		room: t.router({ info: stub }),
		game: t.router({
			ringHistory: stub,
			recentFights: stub,
			ringState: stub,
			consoleHistory: stub,
			pendingPrompt: stub,
			myMonsters: stub,
		}),
	});
}

function batchUrl(baseUrl: string, path: string, roomId: string, procedureCount: number): string {
	const input: Record<string, { roomId: string }> = {};
	for (let i = 0; i < procedureCount; i++) input[String(i)] = { roomId };
	return `${baseUrl}/trpc/${path}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`;
}

async function withServer(
	fastifyOpts: FastifyServerOptions,
	run: (baseUrl: string) => Promise<void>,
): Promise<void> {
	const app = Fastify(fastifyOpts);
	await app.register(fastifyTRPCPlugin, {
		prefix: '/trpc',
		trpcOptions: { router: buildMiniRouter() },
	});
	await app.listen({ port: 0, host: '127.0.0.1' });
	const address = app.server.address();
	if (!address || typeof address === 'string') {
		await app.close();
		throw new Error('expected TCP listen address');
	}
	try {
		await run(`http://127.0.0.1:${address.port}`);
	} finally {
		await app.close();
	}
}

describe('Fastify tRPC batch path length', () => {
	const roomId = '11483952-4af5-48dd-bebe-605f22189e1c';
	const path = terminalBatchPath();
	const procedureCount = path.split(',').length;

	it('documents that the Terminal batch path exceeds Fastify’s default maxParamLength', () => {
		expect(path.length).to.be.greaterThan(100);
		expect(path.length).to.be.lessThan(FASTIFY_MAX_PARAM_LENGTH);
	});

	// Framework-behavior fixture: Fastify defaults to maxParamLength 100. If that
	// default ever rises above our Terminal path length, this fails even though
	// createFastifyOptions still works — keep it as documentation of why we raise.
	it('404s the Terminal batch under Fastify defaults (regression fixture)', async () => {
		await withServer({ logger: false }, async (baseUrl) => {
			const res = await fetch(batchUrl(baseUrl, path, roomId, procedureCount));
			expect(res.status).to.equal(404);
		});
	});

	it('serves the Terminal batch when configured via createFastifyOptions', async () => {
		// Production path: createFastifyOptions sets maxParamLength. logger:false
		// only quiets Pino in the test process.
		await withServer({ ...createFastifyOptions('silent'), logger: false }, async (baseUrl) => {
			const res = await fetch(batchUrl(baseUrl, path, roomId, procedureCount));
			expect(res.status).to.equal(200);
			const body = (await res.json()) as Array<{ result?: { data?: { ok?: boolean } } }>;
			expect(body).to.have.length(procedureCount);
			for (const entry of body) {
				expect(entry.result?.data?.ok).to.equal(true);
			}
		});
	});
});
