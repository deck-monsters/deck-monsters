import { expect } from 'chai';

import Game from '../game.js';
import { createTestChannel, noopStateStore } from '../testing/index.js';
import Basilisk from '../monsters/basilisk.js';
import HitCard from './hit.js';
import { PickPocketCard } from './pick-pocket.js';

/**
 * A room keeps only the card events it can trace to itself (createRoomScopedEventGuard).
 * A boss's hand belongs to no room character, and a narration payload is just
 * `{ narration }`, so a boss's Pick Pocket laid its card box down but never said whose
 * card it took (10b #190). Players' steals always showed, which made it look random.
 */
describe('./cards/pick-pocket.ts in the room feed', () => {
	const setup = async () => {
		const previousSkip = process.env.DECK_MONSTERS_SKIP_DELAYS;
		process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
		const game = new Game({ roomId: 'pick-pocket-feed-room', spawnBosses: false }, () => 0);
		game.stateStore = noopStateStore;
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
		bossMonster.cards = Array.from({ length: bossMonster.cards.length }, () => new HitCard());
		game.ring.contestants.forEach((contestant: any) => contestant.monster.startEncounter(game.ring));

		const cleanup = () => {
			game.dispose();
			if (previousSkip === undefined) delete process.env.DECK_MONSTERS_SKIP_DELAYS;
			else process.env.DECK_MONSTERS_SKIP_DELAYS = previousSkip;
		};
		return { game, published, champion, bossMonster, cleanup };
	};

	it("names the player a boss steals from", async () => {
		const { game, published, champion, bossMonster, cleanup } = await setup();
		try {
			const card = new PickPocketCard();
			bossMonster.cards[0] = card;
			await card.play(bossMonster, champion, game.ring, game.ring.contestants);

			expect(published.join('\n')).to.include(
				`${bossMonster.givenName} steals a card from the hand of Champion`
			);
		} finally {
			cleanup();
		}
	});

	it("still names the boss a player steals from", async () => {
		const { game, published, champion, bossMonster, cleanup } = await setup();
		try {
			const card = new PickPocketCard();
			champion.cards[0] = card as any;
			await card.play(champion, bossMonster, game.ring, game.ring.contestants);

			expect(published.join('\n')).to.include(`Champion steals a card from the hand of ${bossMonster.givenName}`);
		} finally {
			cleanup();
		}
	});
});
