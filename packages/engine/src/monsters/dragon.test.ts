import { expect } from 'chai';
import Dragon from './dragon.js';
import { DRAGON } from '../constants/creature-types.js';
import { WIZARD } from '../constants/creature-classes.js';
import allMonsters from './helpers/all.js';
import { hydrateMonster, monsterHydrateReady } from './helpers/hydrate.js';

describe('monsters/dragon', () => {
	it('can be instantiated with defaults', () => {
		const dragon = new Dragon();

		expect(dragon).to.be.instanceOf(Dragon);
		expect(dragon.name).to.equal('Dragon');
		expect(dragon.creatureType).to.equal(DRAGON);
		expect(dragon.class).to.equal(WIZARD);
		expect(dragon.givenName).to.be.a('string');
		expect(dragon.options).to.include({ dexModifier: 2, strModifier: -1, intModifier: 1, icon: '🐉' });
	});

	it('does not out-armour the best existing spawn AC by more than one', () => {
		const others = allMonsters.filter(M => M !== Dragon).map(M => (M as any).acVariance ?? 0);
		expect((Dragon as any).acVariance).to.be.at.most(Math.max(...others) + 1);
	});

	it('reads its appearance and profile aloud, and never calls the dragon "it"', () => {
		for (const gender of ['male', 'female', 'androgynous']) {
			const dragon = new Dragon({ gender });
			const desc = dragon.description;
			expect(desc).to.include(' dragon, ');
			expect(desc).to.include(dragon.wings);
			expect(desc).to.include('Hoard patience: ');
			expect(desc).to.include('Table manners: ');
			expect(desc).not.to.match(/\bits?\b/i);
		}
	});

	it('agrees verbs with they/them pronouns', () => {
		expect(new Dragon({ gender: 'androgynous', home: 'a sea cave' }).description).to.include('they keep to a sea cave');
		expect(new Dragon({ gender: 'female', home: 'a sea cave' }).description).to.include('she keeps to a sea cave');
	});

	it('uses the correct article and gives a player colour its own sentence', () => {
		const dragon = new Dragon({
			gender: 'male',
			head: 'flat-headed',
			body: 'long and sleek',
			wings: 'swept-back',
			color: 'deep-sea blue with an ember-red belly',
			home: 'the cold deep',
			hoardPatience: 'counts the hoard twice a day',
			smokeControl: 'mostly',
			romanOpinion: 'low',
			tableManners: 'eats the plate too',
		});
		expect(dragon.description).to.equal(
			'a flat-headed dragon, long and sleek, with swept-back wings. His scales are deep-sea blue with an ember-red belly, and he keeps to the cold deep. Hoard patience: counts the hoard twice a day. Smoke control: mostly. Opinion of Romans: low. Table manners: eats the plate too.',
		);
	});

	it('keeps generated appearance through a hydration round trip', async () => {
		await monsterHydrateReady;
		const original = new Dragon({ name: 'Skarn' });
		const restored = hydrateMonster(JSON.parse(JSON.stringify(original))) as Dragon;

		expect(restored).to.be.instanceOf(Dragon);
		expect(restored.description).to.equal(original.description);
	});

	it('is appended after the Unicorn so prompt indexes do not shift', () => {
		expect(allMonsters.map(M => (M as any).name)).to.deep.equal([
			'Basilisk',
			'Gladiator',
			'Jinn',
			'Minotaur',
			'WeepingAngel',
			'Unicorn',
			'Dragon',
		]);
	});
});
