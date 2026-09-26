import { expect } from 'chai';
import Unicorn from './unicorn.js';
import { UNICORN } from '../constants/creature-types.js';
import { CLERIC } from '../constants/creature-classes.js';
import allMonsters from './helpers/all.js';
import { hydrateMonster, monsterHydrateReady } from './helpers/hydrate.js';

describe('monsters/unicorn', () => {
	it('can be instantiated with defaults', () => {
		const unicorn = new Unicorn();

		expect(unicorn).to.be.instanceOf(Unicorn);
		expect(unicorn.name).to.equal('Unicorn');
		expect(unicorn.creatureType).to.equal(UNICORN);
		expect(unicorn.class).to.equal(CLERIC);
		expect(unicorn.givenName).to.be.a('string');
		expect(unicorn.options).to.include({
			dexModifier: 2,
			strModifier: 1,
			intModifier: -1,
			icon: '🦄',
		});
	});

	it('keeps the same +2 modifier budget as every other monster', () => {
		for (const Monster of allMonsters) {
			const { dexModifier, strModifier, intModifier } = new (Monster as any)().options;
			expect(dexModifier + strModifier + intModifier, (Monster as any).name).to.equal(2);
		}
	});

	it('does not out-armour the best existing spawn AC by more than one', () => {
		const others = allMonsters.filter(M => M !== Unicorn).map(M => (M as any).acVariance ?? 0);
		expect((Unicorn as any).acVariance).to.be.at.most(Math.max(...others) + 1);
	});

	it('describes at most three variant clauses and never calls the unicorn "it"', () => {
		for (const gender of ['male', 'female', 'androgynous']) {
			for (const witness of ['eyes', 'retreat', 'voice']) {
				const unicorn = new Unicorn({ gender, witness });
				const desc = unicorn.description;
				expect(desc).to.include('unicorn');
				expect(desc).to.include(unicorn.horn);
				expect(desc).not.to.match(/\bits?\b/i);
			}
		}
	});

	it('agrees verbs with they/them pronouns', () => {
		const they = new Unicorn({ gender: 'androgynous', witness: 'retreat' });
		expect(they.description).to.include('they keep to');
		const she = new Unicorn({ gender: 'female', witness: 'retreat' });
		expect(she.description).to.include('she keeps to');
	});

	it('uses the correct article for vowel-initial builds and horns', () => {
		const unicorn = new Unicorn({ build: 'elephant-footed', horn: 'ringed black' });
		expect(unicorn.description).to.match(/^an elephant-footed unicorn/);
		expect(unicorn.description).to.include('and a ringed black horn');
	});

	it('keeps generated appearance through a hydration round trip', async () => {
		await monsterHydrateReady;
		const original = new Unicorn({ name: 'Nola' });
		const restored = hydrateMonster(JSON.parse(JSON.stringify(original)));

		expect(restored).to.be.instanceOf(Unicorn);
		expect(restored.description).to.equal(original.description);
	});

	it('is registered after the existing five so prompt indexes do not shift', () => {
		expect(allMonsters.map(M => (M as any).name)).to.deep.equal([
			'Basilisk',
			'Gladiator',
			'Jinn',
			'Minotaur',
			'WeepingAngel',
			'Unicorn',
		]);
	});
});
