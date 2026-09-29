import { expect } from 'chai';
import sinon from 'sinon';

import Dragon from './dragon.js';
import Unicorn from './unicorn.js';
import Minotaur from './minotaur.js';
import { BlastCard } from '../cards/blast.js';
import { HitCard } from '../cards/hit.js';
import { TakeWingCard, isAirborne } from '../cards/take-wing.js';
import { getXpCapForLevel } from '../ring/index.js';
import { chance } from '../helpers/chance.js';

/*
 * Roadmap 36 task 2: the candidate answers to the level 7 Dragon folding to Blast, each behind a
 * class setting that is off in play until one is chosen.
 */
describe('Dragon against the Blast family (roadmap 36 candidates)', () => {
	let dragon: any;
	let caster: any;
	let ring: any;
	let contestants: any[];
	const settings = {
		spellResistance: Dragon.spellResistance,
		levelCap: BlastCard.levelCap,
		dodgesSpells: TakeWingCard.dodgesSpells,
	};

	beforeEach(() => {
		const xp = getXpCapForLevel(6) + 1;
		dragon = new Dragon({ name: 'Skarn', xp });
		caster = new Unicorn({ name: 'Nola', xp });
		contestants = [dragon, caster].map(monster => ({ monster, character: {} }));
		ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		dragon.startEncounter(ring);
		caster.startEncounter(ring);
	});

	afterEach(() => {
		sinon.restore();
		Dragon.spellResistance = settings.spellResistance;
		BlastCard.levelCap = settings.levelCap;
		TakeWingCard.dodgesSpells = settings.dodgesSpells;
	});

	const blastDamage = async () => {
		const hit = sinon.spy(Object.getPrototypeOf(Dragon.prototype), 'hit');
		await new BlastCard().effect(caster, dragon);
		const damage = hit.firstCall.args[0];
		hit.restore();
		return damage;
	};

	it('changes nothing by default: a level 7 Blast deals 10', async () => {
		expect(settings).to.deep.equal({ spellResistance: 'none', levelCap: Infinity, dodgesSpells: false });
		expect(dragon.level).to.equal(7);
		expect(await blastDamage()).to.equal(10);
	});

	it('half: the scales halve Blast damage, rounded up', async () => {
		Dragon.spellResistance = 'half';
		expect(await blastDamage()).to.equal(5);
	});

	it('age: the scales take off half the dragon\'s level', async () => {
		Dragon.spellResistance = 'age';
		expect(await blastDamage()).to.equal(10 - 3);
	});

	it('save: a successful save halves it, a failed one does not', async () => {
		Dragon.spellResistance = 'save';
		const roll = sinon.stub(chance, 'roll');
		roll.returns({ result: 30, naturalRoll: { result: 19 }, strokeOfLuck: false, curseOfLoki: false } as any);
		expect(await blastDamage()).to.equal(5);
		roll.returns({ result: 2, naturalRoll: { result: 2 }, strokeOfLuck: false, curseOfLoki: false } as any);
		expect(await blastDamage()).to.equal(10);
	});

	it('leaves every other kind of damage alone', async () => {
		Dragon.spellResistance = 'half';
		const hit = sinon.spy(Object.getPrototypeOf(Dragon.prototype), 'hit');
		await dragon.hit(8, caster, new HitCard());
		expect(hit.firstCall.args[0]).to.equal(8);
	});

	it('does not touch a non-dragon target', async () => {
		Dragon.spellResistance = 'half';
		const minotaur = new Minotaur({ name: 'Bram', xp: getXpCapForLevel(6) + 1 });
		const hit = sinon.spy(minotaur, 'hit');
		await new BlastCard().effect(caster, minotaur);
		expect(hit.firstCall.args[0]).to.equal(10);
	});

	it('levelCap: Blast stops scaling at the cap, for every target', async () => {
		BlastCard.levelCap = 5;
		expect(await blastDamage()).to.equal(3 + 5);
	});

	it('dodgesSpells: a flying dragon dodges the first Blast, then only lands on the next', async () => {
		TakeWingCard.dodgesSpells = true;
		await new TakeWingCard().play(dragon, caster, ring, contestants);
		const hpBefore = dragon.hp;
		await new BlastCard().play(caster, dragon, ring, contestants);
		expect(dragon.hp).to.equal(hpBefore);
		expect(isAirborne(dragon)).to.equal(true);
	});
});
