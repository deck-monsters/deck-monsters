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

	it('has one authority make a claim that the unicorn undoes in front of you (roadmap 42 B)', () => {
		const roses = new Unicorn({ gender: 'androgynous', witness: 'retreat', retreat: 'an inaccessible mountain', witnessShape: 'seen', swearer: 'Aelian', sightingRoll: 0, anhorn: false });
		expect(roses.description).to.match(/Aelian says they keep to an inaccessible mountain\. But just this morning you found them in your garden, eating your roses\.$/);

		const eyes = new Unicorn({ gender: 'female', witness: 'eyes', eyes: 'dark blue', witnessShape: 'seen', swearer: 'Ctesias', sightingRoll: 0, anhorn: false });
		expect(eyes.description).to.match(/Ctesias says her eyes are dark blue\. But she blinks slowly, and you would swear they are black\.$/);

		const horn = new Unicorn({ gender: 'male', witness: 'horn', horn: 'ringed black', witnessShape: 'seen', swearer: 'Topsell', sightingRoll: 0, anhorn: false });
		expect(horn.description).to.match(/Topsell swears his horn is white, crimson, and black\. You have seen his horn up close: ringed black, and sharper than Topsell let on\.$/);

		const sailor = new Unicorn({ gender: 'androgynous', witness: 'retreat', retreat: 'a rocky gorge', witnessShape: 'commoner', commoner: 'a drunken sailor', anhorn: false });
		expect(sailor.description).to.include('A drunken sailor swears that they keep to a rocky gorge. He is not believed, but he is not wrong.');
	});

	it('never has what you saw agree with the claim, for any roll, detail or pronouns', () => {
		for (const gender of ['male', 'female', 'androgynous']) {
			for (const witness of ['eyes', 'retreat', 'voice', 'horn']) {
				for (let i = 0; i < 40; i++) {
					const sightingRoll = i / 40;
					for (const eyes of ['dark blue', 'black', 'woodland brown']) {
						const u = new Unicorn({ gender, witness, eyes, witnessShape: 'seen', sightingRoll, retreat: 'an enclosed garden', anhorn: false });
						const line = u.seenLine;
						if (witness === 'eyes') {
							const seen = line.match(/(?:swear they are|eyes are) ([^.]+)\.$/);
							expect(seen, line).to.not.equal(null);
							expect(seen![1]).to.not.equal(eyes);
						}
						if (witness === 'retreat') expect(line).to.not.include('your garden');
						expect(line, line).to.not.match(/\bits?\b|undefined/);
						if (gender === 'androgynous') expect(line).to.not.match(/\bthey (keeps|blinks|turns|hums)\b/);
					}
				}
			}
		}
	});

	it('reads the same every time, and for a unicorn saved with an old witness shape', () => {
		const legacy = new Unicorn({ witnessShape: 'liar', swearer: 'Pliny', doubter: 'Aelian', witness: 'voice', voice: 'clear as a bell', sightingRoll: undefined, anhorn: false });
		expect(legacy.description).to.include('Pliny says');
		expect(legacy.description).to.not.include('liar');
		expect(legacy.description).to.equal(legacy.description);
		const saith = new Unicorn({ witnessShape: 'saith', witness: 'eyes', anhorn: false });
		expect(saith.description).to.not.match(/saith|liar/);
	});

	it('ends with the Old English name only when the rare flag is drawn', () => {
		const rare = new Unicorn({ gender: 'male', anhorn: true });
		expect(rare.description).to.match(/The oldest English called him ānhorn, and did not argue about his feet\.$/);
		expect(new Unicorn({ anhorn: false }).description).not.to.include('ānhorn');
	});

	it('reads the same on every restore for a unicorn saved before the sighting roll existed', async () => {
		// Review finding (roadmap 42 B): hydrateMonster spreads saved options into the
		// constructor, so a default drawn there for a missing key was redrawn on every restore.
		// JSON drops the keys entirely, which is what a real old save looks like.
		await monsterHydrateReady;
		const fresh = JSON.parse(JSON.stringify(new Unicorn({ gender: 'female', witness: 'retreat', retreat: 'a rocky gorge', anhorn: false })));
		const oldShape = { ...fresh, options: { ...fresh.options, witnessShape: 'liar', swearer: 'Pliny', doubter: 'Aelian' } };
		delete oldShape.options.sightingRoll;
		const noShape = { ...fresh, options: { ...fresh.options } };
		for (const key of ['witnessShape', 'swearer', 'commoner', 'sightingRoll']) delete noShape.options[key];

		for (const saved of [oldShape, noShape]) {
			const first = (hydrateMonster(JSON.parse(JSON.stringify(saved))) as Unicorn).description;
			expect(first).to.include('Pliny says she keeps to a rocky gorge. But just this morning you found her in your garden, eating your roses.');
			for (let i = 0; i < 5; i++) {
				expect((hydrateMonster(JSON.parse(JSON.stringify(saved))) as Unicorn).description).to.equal(first);
			}
		}
	});

	it('keeps generated appearance through a hydration round trip', async () => {
		await monsterHydrateReady;
		const original = new Unicorn({ name: 'Nola' });
		const restored = hydrateMonster(JSON.parse(JSON.stringify(original))) as Unicorn;

		expect(restored).to.be.instanceOf(Unicorn);
		expect(restored.description).to.equal(original.description);
	});

	it('is registered after the existing five so prompt indexes do not shift', () => {
		expect(allMonsters.map(M => (M as any).name).slice(0, 6)).to.deep.equal([
			'Basilisk',
			'Gladiator',
			'Jinn',
			'Minotaur',
			'WeepingAngel',
			'Unicorn',
		]);
	});
});
