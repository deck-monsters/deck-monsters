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
		expect(unicorn.description).to.include('bearing a ringed black horn');
	});

	it('never doubles "with" when the coat carries its own', () => {
		// The spawn prompt suggests this colour; the old sentence read "a coat of ivory white
		// with a dark-red head and a bright ivory horn".
		const unicorn = new Unicorn({ gender: 'androgynous', color: 'ivory white with a dark-red head', horn: 'bright ivory' });
		expect(unicorn.description).to.include('bearing a bright ivory horn. Their coat is ivory white with a dark-red head.');
		expect(unicorn.description).not.to.match(/with[^.]*with/);
	});

	it('lets the old authorities quarrel, and never has one call themself a liar', () => {
		const liar = new Unicorn({ gender: 'female', witness: 'voice', voice: 'low as a lowing ox', witnessShape: 'liar', swearer: 'Pliny', doubter: 'Aelian', anhorn: false });
		expect(liar.description).to.match(/Pliny swears that her voice is low as a lowing ox; Aelian calls Pliny a liar\.$/);

		const saith = new Unicorn({ gender: 'female', witness: 'eyes', eyes: 'dark blue', witnessShape: 'saith', swearer: 'Ctesias', doubter: 'Topsell', anhorn: false });
		expect(saith.description).to.include('So saith Ctesias: her eyes are dark blue. Topsell saith otherwise, and loudly.');

		const sailor = new Unicorn({ gender: 'androgynous', witness: 'retreat', retreat: 'a rocky gorge', witnessShape: 'commoner', commoner: 'a drunken sailor', anhorn: false });
		expect(sailor.description).to.include('A drunken sailor swears that they keep to a rocky gorge. He is not believed, but he is not wrong.');

		const same = new Unicorn({ witnessShape: 'liar', swearer: 'Pliny', doubter: 'Pliny' });
		expect(same.doubter).to.equal('Aelian');
	});

	it('ends with the Old English name only when the rare flag is drawn', () => {
		const rare = new Unicorn({ gender: 'male', anhorn: true });
		expect(rare.description).to.match(/The oldest English called him ānhorn, and did not argue about his feet\.$/);
		expect(new Unicorn({ anhorn: false }).description).not.to.include('ānhorn');
	});

	it('reads the same for a unicorn saved before the witness options existed', () => {
		const legacy = new Unicorn({ witnessShape: undefined, swearer: undefined, doubter: undefined, commoner: undefined });
		expect(legacy.description).to.include('Pliny swears that');
		expect(legacy.description).to.include('Aelian calls Pliny a liar.');
	});

	it('keeps generated appearance through a hydration round trip', async () => {
		await monsterHydrateReady;
		const original = new Unicorn({ name: 'Nola' });
		const restored = hydrateMonster(JSON.parse(JSON.stringify(original))) as Unicorn;

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
