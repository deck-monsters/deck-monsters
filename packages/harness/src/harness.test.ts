import { expect } from 'chai';

import './set-env.js';
import { createTestGame } from '@deck-monsters/engine';
import { capturePublicFeed, formatPublicFeedLines } from './public-feed.js';
import { runRingTwoBosses } from './scenarios/ring-two-bosses.js';

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
});
