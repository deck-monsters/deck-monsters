import { expect } from 'chai';
import sinon from 'sinon';

import Basilisk from '../monsters/basilisk.js';
import Beastmaster from '../characters/beastmaster.js';
import Game from '../game.js';
import { engineReady } from '../helpers/engine-ready.js';
import { listen, loadHandlers } from './index.js';

const USER = { id: 'u1', name: 'Tester' };

/**
 * The summon line and the boss's arrival are two separate publishes, and the arrival
 * carries a ~15-line stat card with it. Published in the wrong order the explanation
 * lands *below* the card and reads as a second, unrelated summon — which is exactly how
 * it looked in the live feed. See 10b-bugs-fixed.md #103.
 */
describe('commands/monster: summon a boss announcement order', () => {
	before(() => {
		loadHandlers();
	});

	afterEach(() => {
		sinon.restore();
	});

	function setup() {
		// One shared log, so publish order and the spawn are recorded on the same timeline.
		const timeline: string[] = [];
		const character = { givenName: 'Tweettypography' };

		const ring = {
			contestants: [{ character, isBoss: false }],
			canAcceptBoss: () => ({ ok: true as const }),
			eventBus: {
				publish: (event: { text: string }) => timeline.push(`publish: ${event.text}`),
			},
			spawnBoss: () => {
				timeline.push('spawnBoss (publishes the arrival + stat card)');
				return { monster: { identity: '🐗 Seeskane Orcbane', displayLevel: '6', creatureType: 'Minotaur' } };
			},
			emit: () => undefined,
		};

		const game = {
			getCharacter: sinon.stub().resolves(character),
			getRing: () => ring,
			bossSummons: {},
			bossSummonsPending: {},
			log: sinon.stub(),
		};

		return { game, character, timeline };
	}

	it('announces the summon before the boss arrives', async () => {
		const { game, timeline } = setup();

		const action = listen({ command: 'summon a boss', game });
		expect(action).to.not.equal(null);

		await action!({
			channel: sinon.stub().resolves(undefined),
			channelName: 'dm',
			isDM: true,
			isAdmin: false,
			user: USER,
			game,
		} as any);

		const summonIndex = timeline.findIndex((entry) => entry.includes('has summoned a boss'));
		const spawnIndex = timeline.findIndex((entry) => entry.includes('spawnBoss'));

		expect(summonIndex, 'the summon line was never published').to.be.greaterThan(-1);
		expect(spawnIndex, 'the boss never spawned').to.be.greaterThan(-1);
		expect(summonIndex).to.be.lessThan(spawnIndex);
	});

	it('publishes the summon line exactly once', async () => {
		const { game, timeline } = setup();

		await listen({ command: 'summon a boss', game })!({
			channel: sinon.stub().resolves(undefined),
			channelName: 'dm',
			isDM: true,
			isAdmin: false,
			user: USER,
			game,
		} as any);

		const summonLines = timeline.filter((entry) => entry.includes('has summoned a boss'));
		expect(summonLines).to.have.lengthOf(1);
		expect(summonLines[0]).to.include('Tweettypography');
	});
});

/**
 * Production check (roadmap 44): `send Keleth to the ring`, then `summon a boss`, answered
 * "Every challenger in the ring already has a boss to face", and a fight began against a boss.
 * Root cause: a boss had already arrived on its own (it waits in an empty ring for a
 * challenger), so the one-boss-per-challenger quota was full and the refusal was right but
 * unexplained. The refusal now names that boss.
 */
describe('commands/monster: summon a boss refusal names the waiting boss', () => {
	before(async () => {
		await engineReady;
		loadHandlers();
	});

	async function summon(game: Game, character: Beastmaster) {
		const channel = sinon.stub().resolves(undefined);
		(game as any).getCharacter = sinon.stub().resolves(character);
		await Promise.resolve(
			listen({ command: 'summon a boss', game })!({
				channel,
				channelName: 'dm',
				isDM: true,
				isAdmin: false,
				user: USER,
				game,
			} as any)
		).catch(() => undefined);
		return channel;
	}

	function joined(game: Game) {
		const ring = game.getRing();
		const character = new Beastmaster();
		const monster = new Basilisk();
		character.addMonster(monster);
		return { ring, character, monster, join: () => ring.addMonster({ monster, character, userId: USER.id }) };
	}

	it('names the boss that was already in the ring when the first monster joined', async () => {
		const game = new Game({}, () => {});
		const { ring, character, monster, join } = joined(game);
		const boss = ring.spawnBoss()!;
		join();

		const channel = await summon(game, character);

		expect(JSON.stringify(channel.args)).to.include(
			`${boss.monster.givenName} is already here for ${monster.givenName}. Bring a friend into the ring, then summon another.`
		);
		expect(ring.bossCount).to.equal(1);
		game.dispose();
	});

	it('summons when no boss is in the ring', async () => {
		const game = new Game({}, () => {});
		const { ring, character, join } = joined(game);
		join();
		expect(ring.bossCount).to.equal(0);

		await summon(game, character);

		expect(ring.bossCount).to.equal(1);
		game.dispose();
	});
});
