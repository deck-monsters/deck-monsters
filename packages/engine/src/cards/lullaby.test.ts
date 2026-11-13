import { expect } from 'chai';
import sinon from 'sinon';

import { LullabyCard, LULLABY_DRAGON_BONUS } from './lullaby.js';
import { HitCard } from './hit.js';
import { armControlWard, getControlWard } from './helpers/control-ward.js';
import { hydrateCard } from './helpers/hydrate.js';
import Jinn from '../monsters/jinn.js';
import Unicorn from '../monsters/unicorn.js';
import Dragon from '../monsters/dragon.js';
import Gladiator from '../monsters/gladiator.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import { BARD } from '../constants/creature-classes.js';
import { UNICORN } from '../constants/creature-types.js';
import { ACOUSTIC } from '../constants/card-classes.js';
import { ATTACK_PHASE } from '../constants/phases.js';

const fakeRoll = (natural: number, modifier = 0) => ({
	primaryDice: '1d20',
	bonusDice: undefined,
	result: natural + modifier,
	naturalRoll: { result: natural },
	bonusResult: 0,
	modifier,
	strokeOfLuck: natural === 20,
	curseOfLoki: natural === 1,
});

const isHeld = (monster: any) =>
	monster.encounterEffects.some((effect: any) => effect.effectType === 'ImmobilizeEffect');

describe('./cards/lullaby.ts Lullaby', () => {
	let singer: any;
	let foe: any;
	let ring: any;
	let contestants: any[];
	let narrations: string[];

	beforeEach(() => {
		singer = new Jinn({ name: 'Zed', gender: 'male', xp: 300 });
		foe = new Gladiator({ name: 'Tor', gender: 'male', xp: 300 });
		contestants = [singer, foe].map(monster => ({ monster, character: {} }));
		ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		for (const { monster } of contestants) {
			monster.startEncounter(ring);
			monster.hp = monster.maxHp;
		}
		narrations = [];
	});

	afterEach(() => sinon.restore());

	const sing = (target: any = foe, card = new LullabyCard(), who = singer) => {
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));
		return card.play(who, target, ring, contestants);
	};

	// Fix the contest roll: `natural` is the d20, the card adds its own modifiers.
	const rolls = (natural: number) =>
		sinon.stub(LullabyCard.prototype, 'getImmobilizeRoll').callsFake(function (this: any, immobilizer: any, immobilized: any) {
			const modifier = immobilizer.intModifier + this.getAttackModifier(immobilized);
			return fakeRoll(natural, modifier) as any;
		});

	it('is an uncommon level 1 Bard and Unicorn card in the Acoustic class, beside Dissonant Voice', () => {
		expect(LullabyCard.permittedClassesAndTypes).to.deep.equal([BARD, UNICORN]);
		expect(LullabyCard.level).to.equal(1);
		expect(new LullabyCard().isCardClass(ACOUSTIC)).to.equal(true);
		expect(new Jinn({ xp: 300 }).canHoldCard(LullabyCard)).to.equal(true);
		expect(new Unicorn({ xp: 300 }).canHoldCard(LullabyCard)).to.equal(true);
		expect(new Gladiator({ xp: 300 }).canHoldCard(LullabyCard)).to.equal(false);
		expect(new LullabyCard().stats).to.include('1d20 + int vs their int, +4 against a Dragon');
		expect(new LullabyCard().stats).to.include('No damage.');
		expect(new LullabyCard().stats).to.not.include('hit instead');
	});

	it('does no damage, and a success dozes the target through the hold', async () => {
		rolls(15);
		const hp = foe.hp;
		await sing();

		expect(isHeld(foe)).to.equal(true);
		expect(foe.hp).to.equal(hp);
		expect(narrations.join('\n')).to.include('Zed 🎶 lulls Tor.');
		expect(narrations.join('\n')).to.include('1d20 + int vs');
	});

	it('rolls 1d20 + the singer\'s int against the target\'s int, and a tie goes to the target', async () => {
		const card = new LullabyCard();
		const events: any[] = [];
		card.on('rolled', (_c: string, _card: any, event: any) => events.push(event));
		// A natural 10 whose total is exactly the target's int.
		sinon.stub(LullabyCard.prototype, 'getImmobilizeRoll').returns(fakeRoll(10, foe.int - 10) as any);

		await card.play(singer, foe, ring, contestants);

		expect(events[0].vs).to.equal(foe.int);
		expect(events[0].success, 'meeting the target\'s int is not enough').to.equal(false);
		expect(isHeld(foe)).to.equal(false);
	});

	it('fails when the roll misses, with no hold and no damage', async () => {
		rolls(2);
		sinon.stub(LullabyCard.prototype, 'checkSuccess').returns({ success: false, strokeOfLuck: false, curseOfLoki: false, tie: false });
		const hp = foe.hp;
		await sing();

		expect(isHeld(foe)).to.equal(false);
		expect(foe.hp).to.equal(hp);
	});

	it('follows the contest rules for a natural 20 (always lands) and a natural 1 (never does)', async () => {
		const stub = rolls(20);
		await sing();
		expect(isHeld(foe), 'a natural 20 lands whatever the int').to.equal(true);

		foe.encounterEffects = [];
		stub.restore();
		rolls(1);
		const card = new LullabyCard();
		const outcomes: string[] = [];
		card.on('rolled', (_c: string, _card: any, { outcome }: any) => outcomes.push(outcome));
		await sing(foe, card);
		expect(isHeld(foe), 'a natural 1 fails whatever the int').to.equal(false);
		expect(outcomes).to.include('Zed yawns in the middle of the verse.');
	});

	it('adds 4 to the roll against a Dragon, and nothing against anyone else', () => {
		const card = new LullabyCard();
		const dragon = new Dragon({ name: 'Skarn', xp: 300 });

		expect(LULLABY_DRAGON_BONUS).to.equal(4);
		expect(card.getImmobilizeRoll(singer, dragon).modifier).to.equal(singer.intModifier + 4);
		expect(card.getImmobilizeRoll(singer, foe).modifier).to.equal(singer.intModifier);
	});

	it('the Dragon matchup shows in the stats and the sleep is 4 harder to shake off (the hold family\'s one matchup rule)', () => {
		const card = new LullabyCard();
		const dragon = new Dragon({ name: 'Skarn', xp: 300 });
		expect(card.getFreedomThreshold(singer, dragon)).to.equal(card.getFreedomThreshold(singer, foe) + 4);
	});

	it('a dozing monster loses its next card unless it wakes', async () => {
		rolls(15);
		await sing();
		sinon.stub(LullabyCard.prototype, 'checkSuccess').returns({ success: false, strokeOfLuck: false, curseOfLoki: false, tie: false });

		const hit = new HitCard();
		const playSpy = sinon.spy();
		(hit as any).play = playSpy;
		let card: any = hit;
		for (const effect of foe.encounterEffects) card = await effect({ card, phase: ATTACK_PHASE, player: foe, ring });

		expect(card).to.equal(hit);
		expect(await card.play()).to.equal(true);
		expect(playSpy.called, 'the real card never plays').to.equal(false);
	});

	it('is cancelled by an armed Horn of Proof ward, which is spent', async () => {
		rolls(15);
		armControlWard(foe);
		const hp = foe.hp;

		await sing();

		expect(isHeld(foe)).to.equal(false);
		expect(getControlWard(foe)).to.equal('spent');
		expect(foe.hp).to.equal(hp);
		expect(narrations.join('\n')).to.include("Horn of Proof's ward is spent.");
	});

	it('does not spend a ward on a failed contest', async () => {
		rolls(1);
		armControlWard(foe);
		await sing();
		expect(getControlWard(foe)).to.equal('armed');
	});

	it('leaves an already dozing monster alone: a line, no new hold, no damage', async () => {
		rolls(15);
		await sing();
		const effects = foe.encounterEffects.length;
		const hp = foe.hp;
		narrations = [];

		await sing();

		expect(foe.encounterEffects).to.have.length(effects);
		expect(foe.hp).to.equal(hp);
		expect(narrations.join('\n')).to.include('Tor is already out cold');
	});

	it('does nothing to a Weeping Angel, which is stone', async () => {
		rolls(15);
		const angel = new WeepingAngel({ name: 'Weep', xp: 300 });
		angel.startEncounter(ring);
		const hp = angel.hp;

		await sing(angel);

		expect(isHeld(angel)).to.equal(false);
		expect(angel.hp).to.equal(hp);
		expect(narrations.join('\n')).to.include('who is stone and does not doze');
	});

	it('sings at the confused target when its player is confused', async () => {
		rolls(15);
		await sing(singer);
		expect(isHeld(singer)).to.equal(true);
	});

	it('survives a JSON hydration round trip', () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new LullabyCard())));
		expect(restored).to.be.an.instanceof(LullabyCard);
	});
});
