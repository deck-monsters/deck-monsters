import zlib from 'node:zlib';

import { repairSerializedGame, type SerializedGame } from '@deck-monsters/engine';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import type { Db } from './db/index.js';
import { rooms } from './db/schema.js';

// Roadmap 37 task 5: convert legacy `rooms.state_blob` (base64 gzip JSON) into `rooms.state`
// (jsonb). Lives in src/ rather than scripts/ so it can be tested.

export interface BackfillOptions {
	dryRun?: boolean;
	/** Restrict to one room. */
	roomId?: string;
	/**
	 * Rollback roll-forward: rewrite `state` from `state_blob` even when `state` is set, and bump
	 * `state_version`. Only safe with the service stopped (the old release must not be writing).
	 */
	fromBlob?: boolean;
	log?: (line: string) => void;
	/** Test seam: runs after the blob is read and decoded, before the write. */
	beforeWrite?: (roomId: string) => void | Promise<void>;
}

export interface BackfillReport {
	converted: number;
	alreadyConverted: number;
	empty: number;
	failed: Array<{ roomId: string; reason: string }>;
	skippedChanged: string[];
	bytes: number;
}

/**
 * Decode without `restoreGame`, so the stored content is what was saved. Mirrors `getOptions`
 * in the engine: plain JSON first, then gunzip+base64. A base64 string can happen to be valid
 * JSON (all digits, say), so a non-object parse falls through to the gzip path too.
 */
export function decodeStateBlob(blob: string): SerializedGame {
	let parsed: unknown;
	try {
		parsed = JSON.parse(blob);
	} catch {
		parsed = undefined;
	}
	if (parsed === undefined || parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		parsed = JSON.parse(zlib.gunzipSync(Buffer.from(blob, 'base64')).toString());
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('decoded state is not an object');
	}
	return parsed as SerializedGame;
}

/**
 * A failure reason that is safe to print. Drizzle's DrizzleQueryError message is
 * `Failed query: <sql>\nparams: <params>`, i.e. the room's whole state and blob, and a
 * JSON.parse error quotes part of the blob. Reports and logs may carry room ids and sizes only,
 * never player data, so only the driver's own cause message (first line, capped) is kept.
 */
export function safeReason(err: unknown): string {
	const cause = (err as { cause?: { message?: unknown } } | null)?.cause;
	const raw = typeof cause?.message === 'string' ? cause.message : err instanceof Error ? err.message : String(err);
	const line = raw.split('\n')[0] ?? '';
	return line.length > 200 ? `${line.slice(0, 200)}...` : line;
}

class DecodeFailure extends Error {}

const KNOWN_FLAGS = new Set(['--dry-run', '--from-blob', '--i-stopped-the-service']);

export interface ParsedArgs {
	dryRun: boolean;
	fromBlob: boolean;
	roomId?: string;
	stoppedService: boolean;
}

/** Strict: a typo like `--dryrun` must not silently turn into a real write. */
export function parseBackfillArgs(args: string[]): ParsedArgs | { error: string } {
	const parsed: ParsedArgs = { dryRun: false, fromBlob: false, stoppedService: false };
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i]!;
		if (arg === '--room') {
			const value = args[i + 1];
			if (!value || value.startsWith('--')) return { error: '--room needs a room id' };
			parsed.roomId = value;
			i += 1;
		} else if (KNOWN_FLAGS.has(arg)) {
			if (arg === '--dry-run') parsed.dryRun = true;
			else if (arg === '--from-blob') parsed.fromBlob = true;
			else parsed.stoppedService = true;
		} else {
			return { error: `unrecognised argument: ${arg.slice(0, 50)}` };
		}
	}
	return parsed;
}

type Outcome = 'converted' | 'alreadyConverted' | 'changed' | 'empty';

export async function backfillRoomState(db: Db, options: BackfillOptions = {}): Promise<BackfillReport> {
	const { dryRun = false, roomId, fromBlob = false, log = () => {}, beforeWrite } = options;
	const report: BackfillReport = { converted: 0, alreadyConverted: 0, empty: 0, failed: [], skippedChanged: [], bytes: 0 };

	// Default mode only picks rooms the server has not converted; --from-blob takes every blob.
	const conditions = [isNotNull(rooms.stateBlob)];
	if (!fromBlob) conditions.push(isNull(rooms.state));
	if (roomId) conditions.push(eq(rooms.id, roomId));
	const candidates = await db
		.select({ id: rooms.id, stateBlob: rooms.stateBlob })
		.from(rooms)
		.where(and(...conditions));

	async function convert(id: string, blob: string): Promise<Outcome> {
		let state: SerializedGame;
		try {
			state = repairSerializedGame(decodeStateBlob(blob)).state;
		} catch {
			throw new DecodeFailure('could not decode blob (not JSON, not gzip)');
		}
		await beforeWrite?.(id);
		if (dryRun) {
			report.bytes += Buffer.byteLength(JSON.stringify(state));
			return 'converted';
		}
		// The blob compare-and-swap keeps an older decode from overwriting a newer blob. Default
		// mode leaves state_version alone: a live store's clock-stamped save must land after us.
		const guard = fromBlob
			? and(eq(rooms.id, id), eq(rooms.stateBlob, blob))
			: and(eq(rooms.id, id), isNull(rooms.state), eq(rooms.stateBlob, blob));
		// --from-blob bumps by one rather than stamping a clock: the operator's clock may run ahead
		// of the server's, and a future stamp would make release 1's guarded saves count as stale.
		// +1 is above every earlier version of this row and immune to skew (roadmap 37).
		const set = fromBlob ? { state, stateVersion: sql`${rooms.stateVersion} + 1` } : { state };
		const updated = await db.update(rooms).set(set).where(guard).returning({ id: rooms.id });
		if (updated.length > 0) {
			report.bytes += Buffer.byteLength(JSON.stringify(state));
			return 'converted';
		}
		return 'changed';
	}

	async function reread(id: string): Promise<{ state: unknown; stateBlob: string | null } | undefined> {
		const [row] = await db
			.select({ state: rooms.state, stateBlob: rooms.stateBlob })
			.from(rooms)
			.where(eq(rooms.id, id))
			.limit(1);
		return row;
	}

	for (const { id, stateBlob } of candidates) {
		if (!stateBlob) {
			report.empty += 1;
			continue;
		}
		try {
			let outcome = await convert(id, stateBlob);
			if (outcome === 'changed') {
				const now = await reread(id);
				if (!now || (!fromBlob && now.state !== null)) {
					// The server saved the room meanwhile, so `state` is already current.
					outcome = 'alreadyConverted';
				} else if (!now.stateBlob) {
					outcome = 'empty';
				} else {
					outcome = await convert(id, now.stateBlob);
				}
			}
			if (outcome === 'converted') report.converted += 1;
			else if (outcome === 'alreadyConverted') report.alreadyConverted += 1;
			else if (outcome === 'empty') report.empty += 1;
			else {
				report.skippedChanged.push(id);
				log(`room ${id}: blob kept changing, skipped`);
			}
		} catch (err) {
			// Left untouched: the server's load path quarantines an undecodable blob.
			report.failed.push({ roomId: id, reason: err instanceof DecodeFailure ? err.message : safeReason(err) });
		}
	}
	return report;
}
