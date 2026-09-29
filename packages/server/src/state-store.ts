import zlib from 'node:zlib';

import type { SerializedGame, StateStore } from '@deck-monsters/engine';
import { eq } from 'drizzle-orm';

import type { Db } from './db/index.js';
import { rooms } from './db/schema.js';

export class PostgresStateStore implements StateStore {
	constructor(private readonly db: Db) {}

	async save(roomId: string, state: SerializedGame): Promise<void> {
		// Roadmap 37 task 4 replaces this with the jsonb write.
		const stateBlob = zlib.gzipSync(JSON.stringify(state)).toString('base64');
		await this.db
			.update(rooms)
			.set({ stateBlob, updatedAt: new Date() })
			.where(eq(rooms.id, roomId));
	}

	async load(roomId: string): Promise<string | null> {
		const rows = await this.db
			.select({ stateBlob: rooms.stateBlob })
			.from(rooms)
			.where(eq(rooms.id, roomId))
			.limit(1);

		return rows[0]?.stateBlob ?? null;
	}
}
