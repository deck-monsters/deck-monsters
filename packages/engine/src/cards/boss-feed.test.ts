import { expect } from 'chai';

import Game from '../game.js';
import { createRoomScopedEventGuard } from '../announcements/index.js';
import { createTestChannel, noopStateStore } from '../testing/index.js';
import Basilisk from '../monsters/basilisk.js';
import HitCard from './hit.js';
import BlastCard from './blast.js';
import { DelayedHit } from './delayed-hit.js';

/**
 * A boss belongs to no room character, so the room guard (createRoomScopedEventGuard) finds
 * its card events through the card's `playedBy` -> the boss -> its encounter -> the ring.
 * The walk marked every object it passed as seen, so when another key of the card reached
 * the boss first, a level deeper, the direct path was skipped: a boss's card boxes, dice
 * rolls, and Delayed Hit lines vanished from the feed, while the damage they did still
 * showed (10b #193, reported from a Unicorn boss's Delayed Hits).
 */
describe("a boss's card events in the room feed", () => {
	it('traces a boss card whose other keys reach the boss a level deeper', () => {
		const game = new Game({ roomId: 'boss-feed-guard-room', spawnBosses: false }, () => 0);
		try {
			const boss = { encounter: { ring: game.ring } };
			// Key order matters: `original` is walked first and reaches the boss at depth 2.
			const card = { original: { playedBy: boss }, playedBy: boss };
			const guard = createRoomScopedEventGuard(game as any);

			expect(guard('HitCard', card, { narration: 'x' })).to.equal(true);
			// Still rooms-only: a boss in another room's ring is not traced to this one.
			const elsewhere = { encounter: { ring: {} } };
			expect(guard('HitCard', { original: { playedBy: elsewhere }, playedBy: elsewhere }, {})).to.equal(false);
		} finally {
			game.dispose();
		}
	});

	it("shows a boss's card boxes, rolls, and Delayed Hit lines in a real fight", async () => {
		const previousSkip = process.env.DECK_MONSTERS_SKIP_DELAYS;
		process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
		const game = new Game({ roomId: 'boss-feed-room', spawnBosses: false }, () => 0);
		game.stateStore = noopStateStore;
		try {
			const published: string[] = [];
			const publish = game.eventBus.publish.bind(game.eventBus);
			(game.eventBus as any).publish = (event: any) => {
				published.push(String(event.text ?? ''));
				return publish(event);
			};

			const channel = createTestChannel(game.eventBus, 'user-a');
			const player = await game.getCharacter({ channel: channel.fn, id: 'user-a', name: 'Ada', gender: 'female', icon: '🦊' });
			const champion = new Basilisk({ name: 'Champion' });
			champion.cards = Array.from({ length: 9 }, () => new HitCard()) as any;
			player.addMonster(champion);
			await player.sendMonsterToTheRing({ ring: game.ring, channel: channel.fn, channelName: 'ring', userId: 'user-a' });

			const boss: any = game.ring.spawnBoss();
			const bossMonster = boss.monster;
			// The boss's turns, in order: a Blast, a Delayed Hit, then Hits.
			bossMonster.cards = [new BlastCard(), new DelayedHit(), ...Array.from({ length: 7 }, () => new HitCard())];
			champion.hp = 200;

			await (game.ring as any).fight();

			const feed = published.join('\n');
			expect(feed).to.include(`${bossMonster.givenName} lays down the following card`);
			expect(feed).to.include(`${bossMonster.givenName} spreads`);
			expect(feed).to.include(`${bossMonster.givenName} rolled`);
		} finally {
			game.dispose();
			if (previousSkip === undefined) delete process.env.DECK_MONSTERS_SKIP_DELAYS;
			else process.env.DECK_MONSTERS_SKIP_DELAYS = previousSkip;
		}
	});
});
