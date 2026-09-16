import { expect } from 'chai';

import { loadFightEventsForSummary } from './analytics-queries.js';

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
		if (Array.isArray(value)) value.forEach((entry) => inspectPredicate(entry, found, seen));
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
});
