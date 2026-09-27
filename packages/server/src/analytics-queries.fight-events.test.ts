import { expect } from 'chai';

import {
	ENGINE_EVENT_ID_PATTERN,
	fightEventIdBounds,
	loadFightEventsForSummary,
} from './analytics-queries.js';

/**
 * Walks a drizzle SQL predicate and collects the column names it references and the
 * values it binds, so a test can assert *what* a query filters on without a database.
 */
function inspectPredicate(
	node: unknown,
	found: { columns: string[]; values: unknown[] },
	// Drizzle columns point back at their table, which points at its columns — walking
	// without this recurses forever.
	seen: WeakSet<object> = new WeakSet()
) {
	if (node === null || typeof node !== 'object') return found;
	if (seen.has(node)) return found;
	seen.add(node);

	const record = node as Record<string, unknown>;

	if (typeof record.name === 'string' && 'table' in record) found.columns.push(record.name);
	if ('value' in record && !('queryChunks' in record)) found.values.push(record.value);

	for (const value of Object.values(record)) {
		if (Array.isArray(value)) {
			value.forEach((entry) => {
				// A value interpolated into a sql`` template sits in queryChunks as a bare
				// primitive rather than a Param object.
				if (typeof entry === 'string') found.values.push(entry);
				else inspectPredicate(entry, found, seen);
			});
		}
		else if (value && typeof value === 'object') inspectPredicate(value, found, seen);
	}
	return found;
}

/** Minimal drizzle-shaped stub that captures the `where` predicate. */
function captureDb() {
	const captured: { where?: unknown } = {};
	const db = {
		select: () => ({
			from: () => ({
				where: (predicate: unknown) => {
					captured.where = predicate;
					return { orderBy: () => [] };
				},
			}),
		}),
	};
	return { db, captured };
}

describe('loadFightEventsForSummary', () => {
	/**
	 * room_events has no fight id, so a fight's events are resolved by time window — which
	 * also catches private events addressed to *other* players during that fight. Without a
	 * visibility filter this handed every player's private fight narration to any room
	 * member who expanded the fight in the fight log.
	 */
	it('filters on event scope, not just room and time window', async () => {
		const { db, captured } = captureDb();

		await loadFightEventsForSummary(
			db as never,
			'room-1',
			'viewer-1',
			new Date(1_000),
			new Date(2_000)
		);

		const found = inspectPredicate(captured.where, { columns: [], values: [] });
		expect(found.columns).to.include('scope');
		expect(found.columns).to.include('target_user_id');
	});

	it('binds the viewer, so private events resolve to the caller only', async () => {
		const { db, captured } = captureDb();

		await loadFightEventsForSummary(
			db as never,
			'room-1',
			'viewer-1',
			new Date(1_000),
			new Date(2_000)
		);

		const found = inspectPredicate(captured.where, { columns: [], values: [] });
		expect(found.values).to.include('viewer-1');
	});

	it('still scopes to the room', async () => {
		const { db, captured } = captureDb();

		await loadFightEventsForSummary(
			db as never,
			'room-1',
			'viewer-1',
			new Date(1_000),
			new Date(2_000)
		);

		const found = inspectPredicate(captured.where, { columns: [], values: [] });
		expect(found.columns).to.include('room_id');
		expect(found.values).to.include('room-1');
	});

	/**
	 * A skipped-delay fight lasts ~50ms and every row is inserted after it resolves, so a
	 * created_at window returned nothing (10b #187). Selection is by the engine time in the
	 * event id instead; created_at is only a loose index bound.
	 */
	it('selects by event id, so rows inserted after the fight resolves still count', async () => {
		const { db, captured } = captureDb();
		const startedAt = new Date(1_727_000_000_000);
		const endedAt = new Date(1_727_000_000_050);

		await loadFightEventsForSummary(db as never, 'room-1', 'viewer-1', startedAt, endedAt);

		const found = inspectPredicate(captured.where, { columns: [], values: [] });
		expect(found.columns).to.include('event_id');
		expect(found.values).to.include('1727000000000');
		expect(found.values).to.include('1727000000051');
		// The insert-time upper bound for id'd rows is well past the resolve timestamp.
		const dates = found.values.filter((value): value is Date => value instanceof Date);
		expect(Math.max(...dates.map((date) => date.getTime()))).to.be.greaterThan(endedAt.getTime() + 60_000);
	});
});

describe('ENGINE_EVENT_ID_PATTERN', () => {
	// Rows it does not match fall back to the created_at window; a legacy id like
	// 'legacy-id' once matched neither rule and vanished from the fight log.
	const pattern = new RegExp(ENGINE_EVENT_ID_PATTERN);

	it('matches engine ids only', () => {
		expect(pattern.test('1727000000000-abcd1234')).to.equal(true);
		expect(pattern.test('legacy-id')).to.equal(false);
		expect(pattern.test('hist:42')).to.equal(false);
	});

	it('is bound into the fight-events query as the fallback test', async () => {
		const { db, captured } = captureDb();
		await loadFightEventsForSummary(db as never, 'room-1', 'viewer-1', new Date(1_000), new Date(2_000));
		const found = inspectPredicate(captured.where, { columns: [], values: [] });
		expect(found.values).to.include(ENGINE_EVENT_ID_PATTERN);
	});
});

describe('fightEventIdBounds', () => {
	const { start, end } = fightEventIdBounds(new Date(1_727_000_000_000), new Date(1_727_000_000_050));
	const inFight = (id: string) => id >= start && id < end;

	it('owns every id from the first to the last millisecond of the fight', () => {
		expect(inFight('1727000000000-abcd1234')).to.equal(true);
		expect(inFight('1727000000050-abcd1234')).to.equal(true);
	});

	it('excludes the millisecond before and after, so neighbouring fights stay separate', () => {
		expect(inFight('1726999999999-abcd1234')).to.equal(false);
		expect(inFight('1727000000051-abcd1234')).to.equal(false);
	});
});
