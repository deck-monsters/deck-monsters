import { expect } from 'chai';
import sinon from 'sinon';

import { UnconquerableHornCard, WOODLAND_COMPANIONS } from './unconquerable-horn.js';
import { HitCard } from './hit.js';
import { hydrateCard } from './helpers/hydrate.js';
import { CONTROL_WARD } from './helpers/control-ward.js';
import Unicorn from '../monsters/unicorn.js';
import Basilisk from '../monsters/basilisk.js';
import Gladiator from '../monsters/gladiator.js';
import { UNICORN } from '../constants/creature-types.js';
import { MELEE } from '../constants/card-classes.js';

const won = { success: true, strokeOfLuck: false, curseOfLoki: false, tie: false };

describe('./cards/unconquerable-horn.ts Unconquerable Horn', () => {
	let unicorn: any;
	let foe: any;
	let ring: any;
	let contestants: any[];

	const setup = (teams?: Record<string, string>, extra: any[] = []) => {
		unicorn = new Unicorn({ name: 'Nola', gender: 'female' });
		foe = new Basilisk({ name: 'Sszar' });
		const monsters = [unicorn, foe, ...extra];
		contestants = monsters.map(monster => ({
			monster,
			character: { team: teams?.[monster.givenName] },
		}));
		ring = {
			contestants,
			encounterEffects: [],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		monsters.forEach(monster => monster.startEncounter(ring));
	};

	const record = (card: any) => {
		const narrations: string[] = [];
		const rolls: any[] = [];
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));
		card.on('rolled', (_c: string, _card: any, payload: any) => rolls.push(payload));
		return { narrations, rolls };
	};

	beforeEach(() => setup());

	afterEach(() => sinon.restore());

	it('is a Unicorn-only level 1 attack that targets its opponent', () => {
		const card = new UnconquerableHornCard();

		expect(card.cardType).to.equal('Unconquerable Horn');
		expect(UnconquerableHornCard.permittedClassesAndTypes).to.deep.equal([UNICORN]);
		expect(UnconquerableHornCard.level).to.equal(1);
		expect(card).to.be.instanceOf(HitCard);
		expect(card.isCardClass(MELEE)).to.equal(true);
		expect(card.getTargets(unicorn, foe)).to.deep.equal([foe]);
	});

	it('says what the rally does, and nothing of the old ward or heal', () => {
		const { stats, description } = new UnconquerableHornCard();

		expect(stats).to.equal(
			'Let the horn ring out: hit your target, and an ally in the ring strikes it too. If you have no ally, a creature of the wood answers its light: an otter, a deer, or a ram (1d20 + 2 to hit, 1d4 damage).'
		);
		expect(stats).not.to.match(/ward|heal/i);
		expect(description).to.include('the horns of unicorns');
	});

	it('reads the companion profile from the class settings', () => {
		sinon.stub(UnconquerableHornCard, 'companionHitBonus').value(5);
		sinon.stub(UnconquerableHornCard, 'companionDamageDice').value('1d8');

		expect(new UnconquerableHornCard().stats).to.include('(1d20 + 5 to hit, 1d8 damage)');
	});

	it('never arms the ward or heals: that is Horn of Proof now', async () => {
		sinon.stub(Object.getPrototypeOf(HitCard.prototype), 'checkSuccess').returns(won);
		unicorn.hp = unicorn.maxHp - 10;
		const before = unicorn.hp;

		await new UnconquerableHornCard().play(unicorn, foe, ring, contestants);

		expect(unicorn.hp).to.equal(before);
		expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal(undefined);
	});

	describe('with no ally in the ring', () => {
		it('hits, then a creature of the wood strikes with the class-setting profile', async () => {
			const card = new UnconquerableHornCard();
			const { narrations, rolls } = record(card);
			sinon.stub(Object.getPrototypeOf(HitCard.prototype), 'checkSuccess').returns(won);
			foe.hp = 100;

			await card.play(unicorn, foe, ring, contestants);

			// Two attack rolls (the unicorn's, then the wood's) and two damage rolls.
			const attacks = rolls.filter(r => r.reason.includes('to determine if'));
			expect(attacks).to.have.length(2);
			expect(attacks[1].roll.primaryDice).to.equal('1d20');
			expect(attacks[1].roll.modifier).to.equal(2);
			expect(attacks[1].who.givenName).to.match(/^(An otter|A deer|A ram) of the wood$/);
			expect(attacks[1].vs).to.equal(foe.ac);

			const damages = rolls.filter(r => r.reason === 'for damage.');
			expect(damages).to.have.length(2);
			expect(damages[1].roll.primaryDice).to.equal('1d4');
			expect(damages[1].roll.modifier).to.equal(0);
			expect(damages[1].roll.result).to.be.within(1, 4);

			expect(narrations.join('\n')).to.include('My horn shalt thou exalt');
			expect(narrations.join('\n')).to.match(/Out of the wood beyond the ring, (an otter|a deer|a ram) answereth the light of the horn\./);
			expect(foe.hp).to.equal(100 - (damages[0].roll.result + damages[1].roll.result));
		});

		it('uses the companion settings for the roll and the damage', async () => {
			sinon.stub(UnconquerableHornCard, 'companionHitBonus').value(30);
			sinon.stub(UnconquerableHornCard, 'companionDamageDice').value('1d1');
			const card = new UnconquerableHornCard();
			const { rolls } = record(card);
			// The unicorn's own hit misses; the wood's +30 cannot.
			const check = sinon.stub(Object.getPrototypeOf(HitCard.prototype), 'checkSuccess');
			check.onFirstCall().returns({ ...won, success: false });
			check.callThrough();
			foe.hp = 100;

			await card.play(unicorn, foe, ring, contestants);

			const damages = rolls.filter(r => r.reason === 'for damage.');
			expect(damages).to.have.length(1);
			expect(damages[0].roll.primaryDice).to.equal('1d1');
			expect(foe.hp).to.equal(99);
		});

		it('never rolls a stroke of luck or Curse of Loki for the wood', async () => {
			const card = new UnconquerableHornCard();
			const { rolls } = record(card);
			sinon.stub(Math, 'random').returns(0);
			sinon.stub(Object.getPrototypeOf(HitCard.prototype), 'checkSuccess').returns(won);

			for (let i = 0; i < 40; i += 1) {
				// eslint-disable-next-line no-await-in-loop
				await card.companionStrike(unicorn, foe, ring);
				foe.hp = 100;
			}

			const wood = rolls.filter(r => r.who?.givenName === 'An otter of the wood' && r.roll?.primaryDice === '1d20');
			expect(wood.length).to.be.above(0);
			wood.forEach(r => {
				expect(r.roll.strokeOfLuck).to.equal(false);
				expect(r.roll.curseOfLoki).to.equal(false);
			});
			// Nothing ever came back on the unicorn.
			expect(unicorn.hp).to.equal(unicorn.maxHp);
		});

		it('misses when the roll does not beat armour class, and a miss does no damage', async () => {
			const card = new UnconquerableHornCard();
			const { narrations } = record(card);
			foe.hp = 50;
			sinon.stub(foe, 'ac').get(() => 99);

			await card.companionStrike(unicorn, foe, ring);

			expect(foe.hp).to.equal(50);
			expect(narrations.join('\n')).to.include('is untouched.');
		});

		it('has an animal for every roll: otter, deer, or ram', () => {
			expect(WOODLAND_COMPANIONS.map(c => c.name)).to.deep.equal(['an otter', 'a deer', 'a ram']);
		});

		it('never takes damage and is not a contestant', async () => {
			const card = new UnconquerableHornCard();
			sinon.stub(Object.getPrototypeOf(HitCard.prototype), 'checkSuccess').returns(won);

			await card.play(unicorn, foe, ring, contestants);

			expect(contestants).to.have.length(2);
			expect(ring.contestants).to.have.length(2);
		});

		it('a duel or free-for-all with teams set has no ally', () => {
			const angel = new Gladiator({ name: 'Ada' });
			setup({ Nola: 'Laurel', Ada: 'Laurel', Sszar: 'Gorge' }, [angel]);
			const card = new UnconquerableHornCard();

			expect(card.findRallyAlly(unicorn, foe, ring, contestants)).to.equal(angel);
			expect(card.findRallyAlly(unicorn, foe, { ...ring, encounterFreeForAll: true }, contestants)).to.equal(undefined);
			expect(card.findRallyAlly(unicorn, foe, ring, contestants.slice(0, 2))).to.equal(undefined);
			expect(card.findRallyAlly(unicorn, foe, ring, undefined)).to.equal(undefined);
		});
	});

	describe('with an ally in the ring', () => {
		let ally: any;

		beforeEach(() => {
			ally = new Gladiator({ name: 'Ada', gender: 'female' });
			setup({ Nola: 'Laurel', Ada: 'Laurel', Sszar: 'Gorge' }, [ally]);
		});

		it('the ally strikes the target with its own stats, and no creature of the wood comes', async () => {
			const card = new UnconquerableHornCard();
			const { narrations, rolls } = record(card);
			sinon.stub(Object.getPrototypeOf(HitCard.prototype), 'checkSuccess').returns(won);
			const companion = sinon.spy(card, 'companionStrike');
			foe.hp = 100;

			await card.play(unicorn, foe, ring, contestants);

			const attacks = rolls.filter(r => r.reason.includes('to determine if'));
			expect(attacks.map(r => r.who)).to.deep.equal([unicorn, ally]);
			expect(attacks[1].roll.modifier).to.equal(ally.dexModifier);
			const damages = rolls.filter(r => r.reason === 'for damage.');
			expect(damages.map(r => r.who)).to.deep.equal([unicorn, ally]);
			expect(damages[1].roll.modifier).to.equal(ally.strModifier);
			expect(companion).not.to.have.been.called;
			expect(narrations.join('\n')).to.include('Ada seeth the light, and heareth the singing of it, and cometh at a run.');
			expect(foe.hp).to.equal(100 - damages[0].roll.result - damages[1].roll.result);
		});

		it('skips a dead ally, and the target itself, and the wood answers instead', async () => {
			ally.hp = 0;
			ally.dead = true;
			const card = new UnconquerableHornCard();
			const companion = sinon.stub(card, 'companionStrike').resolves(true);
			sinon.stub(Object.getPrototypeOf(HitCard.prototype), 'checkSuccess').returns(won);

			expect(card.findRallyAlly(unicorn, foe, ring, contestants)).to.equal(undefined);
			await card.play(unicorn, foe, ring, contestants);

			expect(companion).to.have.been.calledOnce;
		});
	});

	describe('the unicorn\'s own hit', () => {
		it('resolves as a normal Hit first: a miss still brings the call', async () => {
			const card = new UnconquerableHornCard();
			const { rolls } = record(card);
			const check = sinon.stub(Object.getPrototypeOf(HitCard.prototype), 'checkSuccess');
			check.onFirstCall().returns({ ...won, success: false });
			check.callThrough();
			const companion = sinon.stub(card, 'companionStrike').resolves(true);

			await card.play(unicorn, foe, ring, contestants);

			expect(rolls[0].who).to.equal(unicorn);
			expect(rolls[0].outcome).to.equal('Miss...');
			expect(companion).to.have.been.calledOnce;
		});

		it('does not call anyone when the blow already felled the target', async () => {
			const card = new UnconquerableHornCard();
			sinon.stub(Object.getPrototypeOf(HitCard.prototype), 'checkSuccess').returns(won);
			foe.hp = 1;
			const companion = sinon.spy(card, 'companionStrike');
			const ally = sinon.spy(card, 'findRallyAlly');

			await card.play(unicorn, foe, ring, contestants);

			expect(foe.dead).to.equal(true);
			expect(companion).not.to.have.been.called;
			expect(ally).not.to.have.been.called;
		});

		it('does not call anyone when a confused unicorn hits itself', async () => {
			const card = new UnconquerableHornCard();
			sinon.stub(Object.getPrototypeOf(HitCard.prototype), 'checkSuccess').returns(won);
			const companion = sinon.spy(card, 'companionStrike');

			await card.play(unicorn, unicorn, ring, contestants);

			expect(companion).not.to.have.been.called;
		});

		it('does not call anyone when Curse of Loki turns the blow back and fells the unicorn', async () => {
			const card = new UnconquerableHornCard();
			sinon.stub(Object.getPrototypeOf(HitCard.prototype), 'checkSuccess').returns({
				success: false,
				strokeOfLuck: false,
				curseOfLoki: true,
				tie: false,
			});
			unicorn.hp = 1;
			const companion = sinon.spy(card, 'companionStrike');

			await card.play(unicorn, foe, ring, contestants);

			expect(unicorn.dead).to.equal(true);
			expect(companion).not.to.have.been.called;
		});
	});

	it('credits a killing blow from the wood to the unicorn', async () => {
		const card = new UnconquerableHornCard();
		sinon.stub(Object.getPrototypeOf(HitCard.prototype), 'checkSuccess').returns(won);
		foe.hp = 1;

		await card.companionStrike(unicorn, foe, ring);

		expect(foe.dead).to.equal(true);
		expect(foe.killedBy).to.equal(unicorn);
		expect((card as any).flavorText).to.equal(undefined);
	});

	it('hydrates from JSON', () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new UnconquerableHornCard())));
		expect(restored).to.be.instanceOf(UnconquerableHornCard);
	});
});
