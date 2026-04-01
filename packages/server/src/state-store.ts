import type { StateStore } from '@deck-monsters/engine';
import { eq } from 'drizzle-orm';

import type { Db } from './db/index.js';
import { rooms } from './db/schema.js';

export class PostgresStateStore implements StateStore {
	constructor(private readonly db: Db) {}

	async save(roomId: string, state: string): Promise<void> {
		await this.db
			.update(rooms)
			.set({ stateBlob: state, updatedAt: new Date() })
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
