import { expect } from 'chai';

import './set-env.js';
import { createTestGame } from '@deck-monsters/engine';
import { capturePublicFeed, formatPublicFeedLines } from './public-feed.js';
import { runRingTwoBosses } from './scenarios/ring-two-bosses.js';
import { runConcurrentLookMonsters } from './scenarios/concurrent-look-monsters.js';

describe('@deck-monsters/harness', () => {
	it('runs ring-two-bosses and records ordered public feed', async function () {
		this.timeout(60_000);

		const game = createTestGame('harness-test-room');
		const feed = capturePublicFeed(game.eventBus, 'harness-test');

		try {
			await runRingTwoBosses(game);

			expect(feed.events.length, 'should have public ring events').to.be.greaterThan(0);

			// Monotonic capture order matches seq
			for (let i = 0; i < feed.events.length; i++) {
				expect(feed.events[i]!.seq).to.equal(i);
			}

			const text = formatPublicFeedLines(feed);
			expect(text.length).to.be.greaterThan(100);
		} finally {
			feed.unsubscribe();
			game.dispose();
		}
	});

	it('concurrent-look-monsters completes with two characters (serialized like production)', async function () {
		this.timeout(30_000);

		const game = createTestGame('harness-concurrent-room');
		try {
			await runConcurrentLookMonsters(game);
			expect(game.characters['harness-user-a']?.givenName).to.equal('Alice');
			expect(game.characters['harness-user-b']?.givenName).to.equal('Bob');
		} finally {
			game.dispose();
		}
	});
});
