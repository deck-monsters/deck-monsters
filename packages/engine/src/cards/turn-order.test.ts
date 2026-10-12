import { expect } from 'chai';
import sinon from 'sinon';

import { HitCard } from './hit.js';
import { HealCard } from './heal.js';
import { CoilCard } from './coil.js';
import { RandomCard, randomCardHelpers } from './random.js';
import { FireBreathCard } from './fire-breath.js';
import { TakeWingCard, isAirborne } from './take-wing.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import Dragon from '../monsters/dragon.js';
import Minotaur from '../monsters/minotaur.js';

/*
 * The turn order in docs/architecture/cards-and-encounter-effects.md ("Turn order"):
 * time-shift, control, upkeep, the card box, then the card stage. Owner, 2026-10-12: status
 * lines read above the card box, a time-shift skips the whole turn (no time passes), and a
 * hold loses the card but not the turn's upkeep.
 */
describe('turn order (cards/base.ts startTurn)', () => {
	let dragon: any;
	let foe: any;
	let ring: any;
	let contestants: any[];
	let log: string[];

	beforeEach(() => {
		dragon = new Dragon({ name: 'Skarn', gender: 'female', xp: 0 });
		foe = new Minotaur({ name: 'Bram', gender: 'male' });
		contestants = [dragon, foe].map(monster => ({ monster, character: {} }));
		ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		dragon.startEncounter(ring);
		foe.startEncounter(ring);
		log = [];
	});

	afterEach(() => {
		sinon.restore();
		randomCardHelpers.draw = undefined;
	});

	const effect = (name: string, turnStart?: string, losesTurn = false) => {
		const fn: any = ({ card, phase }: any) => {
			if (phase !== ATTACK_PHASE) return card;
			log.push(name);
			if (losesTurn) card.play = () => Promise.resolve(true);
			return card;
		};
		fn.turnStart = turnStart;
		return fn;
	};

	const hit = () => {
		const card = new HitCard();
		card.on('played', () => log.push('box'));
		sinon.stub(card, 'effect').callsFake(async () => {
			log.push('resolve');
			return true;
		});
		return card;
	};

	it('runs time-shift, control, upkeep, the card box, then the card stage', async () => {
		// Added in the "wrong" order on purpose: the stage decides, not insertion order.
		dragon.encounterEffects = [
			effect('card-stage'),
			effect('upkeep', 'upkeep'),
			effect('control', 'control'),
			effect('time-shift', 'timeShift'),
		];

		await hit().play(dragon, foe, ring, contestants);

		expect(log).to.deep.equal(['time-shift', 'control', 'upkeep', 'box', 'card-stage', 'resolve']);
	});

	it('skips everything else on a time-shifted turn: no upkeep, no box, no boosts spent', async () => {
		dragon.encounterEffects = [
			effect('time-shift', 'timeShift', true),
			effect('control', 'control'),
			effect('upkeep', 'upkeep'),
			effect('card-stage'),
		];

		await hit().play(dragon, foe, ring, contestants);

		expect(log).to.deep.equal(['time-shift']);
	});

	it('still runs upkeep on a held turn, but shows no card box and spends no boosts', async () => {
		dragon.encounterEffects = [
			effect('control', 'control', true),
			effect('upkeep', 'upkeep'),
			effect('card-stage'),
		];

		await hit().play(dragon, foe, ring, contestants);

		expect(log).to.deep.equal(['control', 'upkeep']);
	});

	it('says the dragon has its breath back before the card box, not after', async () => {
		const breath = new FireBreathCard();
		breath.on('narration', (_c: string, _card: any, { narration }: any) => log.push(narration));
		breath.wind(dragon);
		log.length = 0;

		await hit().play(dragon, foe, ring, contestants);

		expect(log[0]).to.equal('Skarn has her breath back.');
		expect(log.indexOf('box')).to.be.greaterThan(0);
	});

	it("keeps a time-shifted flier in the air: its dive waits for a card it actually plays", async () => {
		await new TakeWingCard().play(dragon, dragon, ring, contestants);
		dragon.encounterEffects = [effect('time-shift', 'timeShift', true), ...dragon.encounterEffects];

		await hit().play(dragon, foe, ring, contestants);

		expect(isAirborne(dragon)).to.equal(true);
	});

	it('still runs ring reactions that opt in on a lost turn (Delayed Hit answers a drain)', async () => {
		dragon.encounterEffects = [effect('time-shift', 'timeShift', true)];
		const settle: any = ({ card }: any) => {
			log.push('settle');
			return card;
		};
		settle.onLostTurn = true;
		const spent: any = ({ card }: any) => {
			log.push('spent');
			return card;
		};
		ring.encounterEffects = [settle, spent];

		await hit().play(dragon, foe, ring, contestants);

		expect(log).to.deep.equal(['time-shift', 'settle']);
	});

	describe('a burn put out by a Heal', () => {
		const burn = () => {
			const breath = new FireBreathCard();
			breath.on('narration', (_c: string, _card: any, { narration }: any) => log.push(narration));
			breath.ignite(foe, dragon);
		};
		const heal = () => {
			const card = new HealCard();
			card.on('played', () => log.push('heal box'));
			return card;
		};

		it('says so under the Heal box, and takes no burn damage', async () => {
			burn();
			dragon.hp = dragon.maxHp - 5;
			const hp = dragon.hp;

			await heal().play(dragon, dragon, ring, contestants);

			expect(log.slice(0, 2)).to.deep.equal(['heal box', 'Skarn beats out the flames.']);
			expect(dragon.hp).to.be.at.least(hp);
		});

		it('does not put the burn out on a held turn: the Heal is never played', async () => {
			burn();
			dragon.encounterEffects = [effect('control', 'control', true), ...dragon.encounterEffects];
			const hp = dragon.hp;

			await heal().play(dragon, dragon, ring, contestants);

			expect(dragon.hp).to.be.below(hp);
			expect(log).to.not.include('Skarn beats out the flames.');
			expect(log).to.not.include('heal box');
		});

		it('works through Random Play: the burn sees the Heal it becomes', async () => {
			burn();
			const random = new RandomCard();
			random.on('played', () => log.push('random box'));
			randomCardHelpers.draw = () => heal();

			await random.play(dragon, dragon, ring, contestants);

			expect(log.filter(line => !line.startsWith('The ancient scraps'))).to.deep.equal(
				['random box', 'heal box', 'Skarn beats out the flames.'],
			);
		});
	});

	it('never marks the deck card as announced, only the per-play clone', async () => {
		const card = hit();
		await card.play(dragon, foe, ring, contestants);
		await card.play(dragon, foe, ring, contestants);

		expect((card as any).announced).to.equal(undefined);
		expect(log.filter(line => line === 'box')).to.have.length(2);
	});

	it('knocks a flier out of the sky when it is held (owner rule)', async () => {
		await new TakeWingCard().play(dragon, dragon, ring, contestants);
		const coil = new CoilCard();
		coil.on('narration', (_c: string, _card: any, { narration }: any) => log.push(narration));
		sinon.stub(coil, 'immobilizeCheck').returns(true);

		coil.immobilize(foe, dragon, ring, contestants);

		expect(isAirborne(dragon)).to.equal(false);
		expect(log).to.include('Skarn falls out of the sky! No dive this time.');
	});

	describe('Random Play', () => {
		const random = () => {
			const card = new RandomCard();
			card.on('played', () => log.push('random box'));
			randomCardHelpers.draw = () => hit();
			return card;
		};

		it('runs upkeep before its own box, and the drawn card in the card stage', async () => {
			dragon.encounterEffects = [effect('upkeep', 'upkeep'), effect('card-stage')];

			await random().play(dragon, foe, ring, contestants);

			expect(log).to.deep.equal(['upkeep', 'random box', 'box', 'card-stage', 'resolve']);
		});

		it('still lets Delayed Hit answer on a lost turn', async () => {
			dragon.encounterEffects = [effect('time-shift', 'timeShift', true)];
			const settle: any = ({ card }: any) => {
				log.push('settle');
				return card;
			};
			settle.onLostTurn = true;
			ring.encounterEffects = [settle];

			await random().play(dragon, foe, ring, contestants);

			expect(log).to.deep.equal(['time-shift', 'settle']);
		});

		it('finds no scraps on a time-shifted turn', async () => {
			dragon.encounterEffects = [effect('time-shift', 'timeShift', true), effect('upkeep', 'upkeep')];

			await random().play(dragon, foe, ring, contestants);

			expect(log).to.deep.equal(['time-shift']);
		});
	});
});
