import { EventEmitter } from 'node:events';
import { expect } from 'chai';

import type { RoomEventBus } from '@deck-monsters/engine';
import { attachMetricsCollector } from './collector.js';
import { bossSpawns, turnGapMs, registry } from './index.js';

const ROOM_ID = 'room-test';

function readBossSpawnCount(roomId: string): Promise<number> {
	return bossSpawns.get().then((metric) => {
		const sample = metric.values.find((value) => value.labels?.room_id === roomId);
		return sample?.value ?? 0;
	});
}

function readTurnGapSampleCount(roomId: string): Promise<number> {
	return turnGapMs.get().then((metric) =>
		metric.values.find(
			(value) =>
				value.metricName.endsWith('_count') &&
				value.labels?.room_id === roomId &&
				!('le' in (value.labels ?? {}))
		)?.value ?? 0
	);
}

describe('metrics collector ring add listener', () => {
	beforeEach(() => {
		registry.resetMetrics();
	});

	it('handles BaseClass ring add event args and counts boss spawns', async () => {
		const eventBus = {
			subscribe: () => () => {},
		} satisfies Pick<RoomEventBus, 'subscribe'>;
		const ring = new EventEmitter();
		const cleanup = attachMetricsCollector(eventBus as unknown as RoomEventBus, ring as any, ROOM_ID);

		expect(() => ring.emit('add', 'Ring', ring, { contestant: { isBoss: true } })).to.not.throw();
		expect(() => ring.emit('add', 'Ring', ring, { contestant: { isBoss: false } })).to.not.throw();
		expect(() => ring.emit('add', 'Ring', ring)).to.not.throw();

		expect(await readBossSpawnCount(ROOM_ID)).to.equal(1);
		cleanup();
	});

	it('records turn-gap metrics from card.played events and resets on fight boundaries', async () => {
		let deliverFn: ((event: { type: string; payload?: Record<string, unknown>; timestamp: number }) => void) | null = null;
		const eventBus = {
			subscribe: (_id: string, sub: { deliver: (event: { type: string; payload?: Record<string, unknown>; timestamp: number }) => void }) => {
				deliverFn = sub.deliver;
				return () => { deliverFn = null; };
			},
		} satisfies Pick<RoomEventBus, 'subscribe'>;
		const ring = new EventEmitter();
		const cleanup = attachMetricsCollector(eventBus as unknown as RoomEventBus, ring as any, ROOM_ID);

		expect(deliverFn).to.not.equal(null);
		const emit = (
			type: string,
			timestamp: number,
			payload: Record<string, unknown> = {}
		) => deliverFn?.({ type, payload, timestamp });

		// Within one encounter, two gaps should be recorded: 1500ms and 2200ms.
		emit('ring.fight', 1_000, { eventName: 'fightBegins' });
		emit('card.played', 2_000);
		emit('card.played', 3_500);
		emit('card.played', 5_700);

		// New encounter should reset the previous-turn anchor.
		emit('ring.fight', 8_000, { eventName: 'fightBegins' });
		emit('card.played', 9_000); // no gap yet (first card after reset)
		emit('card.played', 10_250); // one gap in second encounter

		expect(await readTurnGapSampleCount(ROOM_ID)).to.equal(3);
		cleanup();
	});
});
