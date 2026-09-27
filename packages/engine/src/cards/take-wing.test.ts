import { expect } from 'chai';
import sinon from 'sinon';

import { TakeWingCard, isAirborne, DIVE_HIT_BONUS } from './take-wing.js';
import { HitCard } from './hit.js';
import { HealCard } from './heal.js';
import { BlastCard } from './blast.js';
import { hydrateCard } from './helpers/hydrate.js';
import Dragon from '../monsters/dragon.js';
import Minotaur from '../monsters/minotaur.js';
import { DRAGON } from '../constants/creature-types.js';

describe('./cards/take-wing.ts Take Wing', () => {
	let dragon: any;
	let foe: any;
	let ring: any;
	let contestants: any[];
	let narrations: string[];

	beforeEach(() => {
		dragon = new Dragon({ name: 'Skarn', gender: 'female', xp: 0 });
		foe = new Minotaur({ name: 'Bram', gender: 'male' });
		contestants = [dragon, foe].map(monster => ({ monster, character: {} }));
		ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		dragon.startEncounter(ring);
		foe.startEncounter(ring);
		narrations = [];
	});

	afterEach(() => sinon.restore());

	const listen = (card: any) => {
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));
		return card;
	};

	const takeOff = () => listen(new TakeWingCard()).play(dragon, foe, ring, contestants);

	// A foe's Hit that always lands for 3.
	const foeHits = () => {
		const hit = new HitCard();
		sinon.stub(hit, 'hitCheck').returns({ attackRoll: { result: 20 }, success: true, strokeOfLuck: false, curseOfLoki: false } as any);
		sinon.stub(hit, 'rollForDamage').returns({ result: 3 } as any);
		return hit.play(foe, dragon, ring, contestants);
	};

	it('is a level 0, Dragon-only card that targets its player', () => {
		expect(TakeWingCard.permittedClassesAndTypes).to.deep.equal([DRAGON]);
		expect(TakeWingCard.level).to.equal(0);
		expect(new TakeWingCard().getTargets(dragon)).to.deep.equal([dragon]);
		expect(foe.canHoldCard(TakeWingCard)).to.equal(false);
	});

	it('dodges the first melee blow, but not the second', async () => {
		const hp = dragon.hp;
		await takeOff();
		expect(isAirborne(dragon)).to.equal(true);

		await foeHits();
		expect(dragon.hp).to.equal(hp);
		expect(narrations.join('\n')).to.include("Skarn is high in the air, and Bram's blow strikes empty air.");

		await foeHits();
		expect(dragon.hp).to.equal(hp - 3);
		expect(isAirborne(dragon), 'a blow that lands knocks her down').to.equal(false);
		expect(narrations.join('\n')).to.include('Skarn is knocked out of the sky! No dive this time.');
	});

	it('is knocked down by area damage, which it cannot dodge', async () => {
		const hp = dragon.hp;
		await takeOff();

		await new BlastCard().play(foe, dragon, ring, contestants);

		expect(dragon.hp).to.be.below(hp);
		expect(isAirborne(dragon)).to.equal(false);
	});

	it('dives on the next card when it is a melee attack', async () => {
		await takeOff();
		const hit = new HitCard();
		const attackRolls: any[] = [];
		const damageRolls: any[] = [];
		hit.on('rolled', (_c: string, _card: any, { reason, roll }: any) => {
			if (reason === 'for damage.') damageRolls.push(roll);
			else attackRolls.push(roll);
		});

		await hit.play(dragon, foe, ring, contestants);

		expect(isAirborne(dragon)).to.equal(false);
		expect(narrations.join('\n')).to.include('Skarn folds her wings and dives!');
		expect(attackRolls[0].modifier).to.equal(dragon.dexModifier + DIVE_HIT_BONUS);
		if (damageRolls.length) {
			expect(damageRolls[0].modifier).to.be.within(dragon.strModifier + 1, dragon.strModifier + 6);
		}
	});

	it('glides down without a dive when the next card is not an attack', async () => {
		await takeOff();
		await new HealCard().play(dragon, dragon, ring, contestants);

		expect(isAirborne(dragon)).to.equal(false);
		expect(narrations.join('\n')).to.include('Skarn glides back down to the sand.');
	});

	it('clears with the fight', async () => {
		await takeOff();
		dragon.endEncounter();
		expect(isAirborne(dragon)).to.equal(false);
	});

	it('reads sensibly when confusion lifts a foe instead', async () => {
		await listen(new TakeWingCard()).effect(dragon, foe, ring);
		expect(isAirborne(foe)).to.equal(true);
		expect(narrations[0]).to.include('In confusion, Skarn flings Bram into the air.');
	});

	it('survives a JSON hydration round trip', () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new TakeWingCard())));
		expect(restored).to.be.instanceOf(TakeWingCard);
	});
});
