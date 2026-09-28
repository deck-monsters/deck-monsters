import { expect } from 'chai';
import sinon from 'sinon';

import Game from '../game.js';
import Basilisk from '../monsters/basilisk.js';
import Beastmaster from '../characters/beastmaster.js';
import {
	fitMegaBoss,
	MEGA_BOSS_ANNOUNCE_MS,
	megaBossHpShare,
	MEGA_BOSS_LEVEL_BONUS,
	MEGA_BOSS_MAX_INTERVAL_MS,
	MEGA_BOSS_MIN_INTERVAL_MS,
	MEGA_BOSS_MINIONS,
	MEGA_BOSS_REWARD_COINS,
} from './mega-boss.js';

const MINUTE = 60_000;

/**
 * The mega boss (owner, 2026-09-27; docs/roadmap/32-pass-c-mega-boss-and-balance.md): about
 * once a day, announced 30 minutes ahead, fitted to the humans in the ring when it arrives,
 * called off for a regular boss with fewer than two, and paying the challengers still
 * standing when it falls.
 */
describe('./ring/mega-boss.ts', () => {
	let clock: sinon.SinonFakeTimers;

	beforeEach(() => {
		clock = sinon.useFakeTimers({ now: 1_000_000_000_000, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
	});

	afterEach(() => {
		clock.restore();
	});

	const addPlayer = (game: Game, userId: string) => {
		const character = new Beastmaster();
		const monster = new Basilisk();
		character.addMonster(monster);
		(game.characters as Record<string, unknown>)[userId] = character;
		game.ring.addMonster({ monster, character, userId });
		return { character, monster };
	};

	const narrations = (game: Game): string[] => {
		const lines: string[] = [];
		game.ring.on('narration', (_c: string, _r: unknown, { narration }: { narration: string }) => lines.push(narration));
		return lines;
	};

	it('fits two levels above the strongest human, with HP a share of theirs', () => {
		const fit = fitMegaBoss([{ level: 2, maxHp: 30 }, { level: 5, maxHp: 40 }]);
		expect(fit.level).to.equal(5 + MEGA_BOSS_LEVEL_BONUS);
		expect(fit.maxHp).to.equal(Math.round(70 * megaBossHpShare(2, 5)));
		expect(fit.minionLevel).to.equal(2);
	});

	it('schedules about a day out and keeps the time in the room state', () => {
		const game = new Game({ roomId: 'mega-schedule' }, () => {});
		try {
			const at = (game.options as any).megaBossAt as number;
			expect(at - Date.now()).to.be.within(MEGA_BOSS_MIN_INTERVAL_MS, MEGA_BOSS_MAX_INTERVAL_MS);

			// A restart picks the same time up rather than rolling a new one.
			const restarted = new Game({ roomId: 'mega-schedule-2', megaBossAt: at }, () => {});
			expect((restarted.options as any).megaBossAt).to.equal(at);
			restarted.dispose();
		} finally {
			game.dispose();
		}
	});

	it('saves a freshly rolled time as soon as the room gets its store', () => {
		// The server attaches the store after construction; the rolled time waited for an
		// unrelated save, and a second restart rolled a new day (the Pass C review).
		const game = new Game({ roomId: 'mega-save' }, () => {});
		try {
			const saves: string[] = [];
			game.stateStore = { save: (_roomId: string, state: string) => { saves.push(state); return Promise.resolve(); } } as any;
			// Just past the save debounce, and long before any other timer would save.
			clock.tick(45_000);
			expect(saves.length).to.be.above(0);
		} finally {
			game.dispose();
		}
	});

	it('announces 30 minutes ahead with a countdown, then brings a fitted boss and its minions', () => {
		const at = Date.now() + MEGA_BOSS_ANNOUNCE_MS + 5 * MINUTE;
		const game = new Game({ roomId: 'mega-arrive', megaBossAt: at }, () => {});
		const lines = narrations(game);
		try {
			expect(game.ring.nextMegaBossAt).to.equal(null);
			clock.tick(5 * MINUTE);
			expect(game.ring.nextMegaBossAt).to.equal(at);
			expect(lines.some(line => line.includes('A MEGA BOSS is coming'))).to.equal(true);

			// Challengers gather in its last minute. Their ordinary fight countdown ends inside
			// the hold, so they wait for it instead of fighting each other.
			clock.tick(MEGA_BOSS_ANNOUNCE_MS - 1.5 * MINUTE);
			const first = addPlayer(game, 'user-1');
			const second = addPlayer(game, 'user-2');
			clock.tick(1.5 * MINUTE);
			expect(lines.some(line => line.includes('The ring holds its breath'))).to.equal(true);
			const party = game.ring.contestants.filter(contestant => contestant.mega);
			expect(party).to.have.length(1 + MEGA_BOSS_MINIONS);
			const [boss] = party.filter(contestant => !contestant.minion);
			const fit = fitMegaBoss([first.monster, second.monster].map(monster => ({ level: monster.level, maxHp: monster.maxHp })));
			expect(boss!.monster.level).to.equal(fit.level);
			expect(boss!.monster.maxHp).to.equal(fit.maxHp);
			expect(lines.some(line => line.includes('THE MEGA BOSS HAS COME'))).to.equal(true);
			expect(game.ring.nextMegaBossAt).to.equal(null);
			// The next one is already scheduled, about a day on.
			expect((game.options as any).megaBossAt - Date.now()).to.be.within(MEGA_BOSS_MIN_INTERVAL_MS, MEGA_BOSS_MAX_INTERVAL_MS);
		} finally {
			game.dispose();
		}
	});

	it('is called off for a regular boss when only one human is in the ring', () => {
		const at = Date.now() + MINUTE;
		const game = new Game({ roomId: 'mega-cancel', megaBossAt: at }, () => {});
		const lines = narrations(game);
		try {
			addPlayer(game, 'user-1');
			clock.tick(MINUTE);
			expect(lines.some(line => line.includes('will not be insulted by so pitiful a showing'))).to.equal(true);
			expect(game.ring.contestants.some(contestant => contestant.mega)).to.equal(false);
			expect(game.ring.bossCount).to.equal(1);
		} finally {
			game.dispose();
		}
	});

	it('keeps its party when a human leaves, and sends regular bosses away when it comes', () => {
		const at = Date.now() + MINUTE;
		const game = new Game({ roomId: 'mega-party', megaBossAt: at }, () => {});
		try {
			addPlayer(game, 'user-1');
			addPlayer(game, 'user-2');
			const regular = game.ring.spawnBoss()!;
			clock.tick(MINUTE);
			expect(game.ring.contestants.some(contestant => contestant.monster === regular.monster)).to.equal(false);

			game.ring.contestants = game.ring.contestants.filter(contestant => contestant.isBoss || contestant.userId !== 'user-2');
			game.ring.dismissExtraBosses();
			expect(game.ring.contestants.filter(contestant => contestant.mega)).to.have.length(1 + MEGA_BOSS_MINIONS);
		} finally {
			game.dispose();
		}
	});

	it('leaves the ring with its minions when every challenger withdraws before the fight', async () => {
		// Its party has no despawn timer and is exempt from the boss quota, so with no humans
		// left it stayed in the ring for good (the Pass C review).
		const at = Date.now() + MINUTE;
		const game = new Game({ roomId: 'mega-withdraw', megaBossAt: at }, () => {});
		try {
			const first = addPlayer(game, 'user-1');
			const second = addPlayer(game, 'user-2');
			clock.tick(MINUTE);
			expect(game.ring.contestants.filter(contestant => contestant.mega)).to.have.length(1 + MEGA_BOSS_MINIONS);

			await game.ring.removeMonster({ ...first, userId: 'user-1' });
			await game.ring.removeMonster({ ...second, userId: 'user-2' });
			expect(game.ring.contestants).to.have.length(0);
		} finally {
			game.dispose();
		}
	});

	it('pays every challenger still standing when it falls', () => {
		const at = Date.now() + MINUTE;
		const game = new Game({ roomId: 'mega-reward', megaBossAt: at }, () => {});
		try {
			const first = addPlayer(game, 'user-1');
			const second = addPlayer(game, 'user-2');
			clock.tick(MINUTE);
			const boss = game.ring.contestants.find(contestant => contestant.mega && !contestant.minion)!;
			const coinsBefore = [first.character.coins, second.character.coins];
			const cardsBefore = [first.character.cards.length, second.character.cards.length];
			second.monster.hp = 0;
			(second.monster as any).setOptions({ dead: true });

			boss.monster.emit('die', {});

			expect(first.character.coins - coinsBefore[0]!).to.equal(MEGA_BOSS_REWARD_COINS);
			expect(first.character.cards.length).to.equal(cardsBefore[0]! + 1);
			expect(second.character.coins).to.equal(coinsBefore[1]);
			expect(second.character.cards.length).to.equal(cardsBefore[1]);
		} finally {
			game.dispose();
		}
	});
});
