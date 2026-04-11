import { expect } from 'chai';

import { dbRowToGameEvent } from './game-event-map.js';

describe('dbRowToGameEvent', () => {
	it('uses embedded eventId timestamp for deterministic history ordering', () => {
		const row = {
			id: 42,
			roomId: 'room-1',
			type: 'ring.fight',
			scope: 'public',
			targetUserId: null,
			payload: {},
			text: 'fight event',
			eventId: '1712835000123-abcd1234',
			createdAt: new Date('2026-04-11T07:50:50.999Z'),
		};

		const mapped = dbRowToGameEvent(row);
		expect(mapped.timestamp).to.equal(1712835000123);
	});

	it('falls back to createdAt when eventId has no timestamp prefix', () => {
		const createdAt = new Date('2026-04-11T07:50:50.999Z');
		const row = {
			id: 43,
			roomId: 'room-1',
			type: 'ring.fight',
			scope: 'public',
			targetUserId: null,
			payload: {},
			text: 'legacy event',
			eventId: 'legacy-id',
			createdAt,
		};

		const mapped = dbRowToGameEvent(row);
		expect(mapped.timestamp).to.equal(createdAt.getTime());
	});
});
