import type { Db } from '../db/index.js';
import { ChatService, type ChatPlayer } from './chat-service.js';

/**
 * An in-memory ChatService for unit tests: players, the fight stamp and storage are
 * overridable seams, so validation, rate limiting, name resolution and delivery run with no
 * database. History, unread, read position and the sweep are SQL and covered by
 * chat-service.pg.test.ts.
 */
export class FakeChatService extends ChatService {
	players: Array<ChatPlayer & { displayName: string }> = [];
	fight: number | null = null;
	stored: Array<Record<string, unknown>> = [];
	clock = 1_000_000;
	private nextId = 1;

	constructor() {
		super({} as Db, { getGame: async () => ({}) as never }, () => this.clock);
	}

	/** Open subscriptions for a room, to assert a feed tore its subscription down. */
	listenerCount(roomId: string): number {
		return (this as unknown as { emitter: { listenerCount(e: string): number } }).emitter.listenerCount(roomId);
	}

	protected override async loadPlayers() {
		return this.players;
	}

	protected override async currentFightNumber() {
		return this.fight;
	}

	protected override async insertMessage(row: Record<string, unknown> & { roomId: string }) {
		this.stored.push(row);
		return { id: this.nextId++, createdAt: new Date(this.clock) };
	}
}

export function player(userId: string, name: string, displayName = name) {
	return { userId, name, displayName };
}
