import zlib from 'node:zlib';

import type { SerializedGame, StateStore } from '@deck-monsters/engine';
import { and, eq, lt } from 'drizzle-orm';

import type { Db } from './db/index.js';
import { rooms } from './db/schema.js';
import { roomStateSaveBytes, roomStateSaveFailures, roomStateSavesStale } from './metrics/index.js';

let lastStateVersion = 0;

/**
 * One process-wide monotonic clock for `rooms.state_version` (roadmap 37 task 4).
 * `Date.now() * 1000` is about 1.8e15: inside Number.MAX_SAFE_INTEGER and bigint, and it lets a
 * restart continue above every version the previous process wrote. It is process-wide, not
 * per-store, so a room that unloads and reloads (new store) keeps counting upward.
 *
 * The one assumption: the server clock does not step back by more than the gap between two
 * saves of the same room across a restart.
 */
export function nextStateVersion(): number {
	lastStateVersion = Math.max(lastStateVersion + 1, Date.now() * 1000);
	return lastStateVersion;
}

export class PostgresStateStore implements StateStore {
	constructor(private readonly db: Db) {}

	async save(roomId: string, state: SerializedGame): Promise<void> {
		// Stamp synchronously, before any await: the engine calls save() synchronously inside
		// persistState(), so version order is snapshot order even when the writes (on different
		// pool connections) land in any order.
		const version = nextStateVersion();
		await this.write(roomId, state, version);
	}

	/** The guarded write. Split from `save` so tests can land a chosen version. */
	async write(roomId: string, state: SerializedGame, version: number): Promise<void> {
		try {
			const json = JSON.stringify(state);
			roomStateSaveBytes.observe(Buffer.byteLength(json));
			// Release 1 dual-writes the legacy blob so a redeploy of the previous release still
			// restores current state. Task 6 (contract) removes this.
			const legacyBlob = zlib.gzipSync(json).toString('base64');
			// `state` is passed as the object itself: node-postgres + Drizzle JSON.stringify it once
			// into a jsonb object (a pre-stringified value would be stored as a jsonb string).
			const updated = await this.db
				.update(rooms)
				.set({ state, stateVersion: version, stateBlob: legacyBlob, updatedAt: new Date() })
				.where(and(eq(rooms.id, roomId), lt(rooms.stateVersion, version)))
				.returning({ id: rooms.id });
			if (updated.length === 0) {
				// A newer snapshot, a quarantine or a reset already landed. Never retry: retrying
				// would resurrect exactly the state that was superseded.
				roomStateSavesStale.inc();
			}
		} catch (err) {
			roomStateSaveFailures.inc();
			throw err;
		}
	}

	async load(roomId: string): Promise<SerializedGame | string | null> {
		const rows = await this.db
			.select({ state: rooms.state, stateBlob: rooms.stateBlob })
			.from(rooms)
			.where(eq(rooms.id, roomId))
			.limit(1);

		return rows[0]?.state ?? rows[0]?.stateBlob ?? null;
	}
}
