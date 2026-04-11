import { EventEmitter } from 'node:events';
import { expect } from 'chai';

import type { RoomEventBus } from '@deck-monsters/engine';
import { attachMetricsCollector } from './collector.js';
import { bossSpawns, registry } from './index.js';

const ROOM_ID = 'room-test';

function readBossSpawnCount(roomId: string): Promise<number> {
	return bossSpawns.get().then((metric) => {
		const sample = metric.values.find((value) => value.labels?.room_id === roomId);
		return sample?.value ?? 0;
	});
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
});
