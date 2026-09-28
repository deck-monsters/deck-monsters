import { expect } from 'chai';
import Beastmaster from '../beastmaster.js';
import randomCharacter, { helpersReady } from './random.js';
import { RING_PATRON_ICON, RING_PATRON_NAME } from '../../constants/lore.js';

describe('characters/helpers/random', () => {
	it('returns a Beastmaster instance', () => {
		const character = randomCharacter();

		expect(character).to.be.instanceOf(Beastmaster);
	});

	it('character has a given name', () => {
		const character = randomCharacter();

		expect(character.givenName).to.be.a('string');
	});

	it('gives generated monsters a real colour and its hex, not the "gray" fallback', async () => {
		// grab-color-names is CommonJS; its randomColor lives on `default` under import(). The
		// loader read the named export, got undefined, and every boss came out "gray".
		await helpersReady;
		const colours = new Set<string>();
		for (let i = 0; i < 12; i += 1) {
			const [monster] = (randomCharacter({ isBoss: true }) as any).monsters;
			expect(monster.options.colorHex).to.match(/^#[0-9a-f]{6}$/);
			colours.add(monster.options.color);
		}
		expect([...colours]).to.not.deep.equal(['gray']);
		expect(colours.size).to.be.greaterThan(1);
	});

	it('returns a boss when isBoss is set', () => {
		const character = randomCharacter({ isBoss: true });

		expect(character).to.be.instanceOf(Beastmaster);
		expect((character as any).isBoss).to.equal(true);
	});

	/**
	 * A boss belongs to the house, so it is generated as the house. #102 substituted the
	 * patron at the two arrival/departure call sites, which left every other line printing
	 * the invented owner — the turn banner read "It's Hopewing's turn." with a boss in the
	 * ring. Naming the character itself fixes those sites and any future one at once.
	 */
	describe('boss ownership', () => {
		before(async () => { await helpersReady; });

		it('names a generated boss owner after the house', () => {
			expect(randomCharacter({ isBoss: true }).givenName).to.equal(RING_PATRON_NAME);
		});

		it('gives it the house icon, so `identity` reads right inline', () => {
			expect(randomCharacter({ isBoss: true }).identity).to.equal(
				`${RING_PATRON_ICON} ${RING_PATRON_NAME}`,
			);
		});

		it('leaves the boss monster its own name — only the owner is the house', () => {
			const boss = randomCharacter({ isBoss: true });
			const monster = (boss as any).monsters[0];

			expect(monster.givenName).to.be.a('string');
			expect(monster.givenName).to.not.equal(RING_PATRON_NAME);
		});

		it('leaves ordinary characters alone', () => {
			expect(randomCharacter().givenName).to.not.equal(RING_PATRON_NAME);
		});

		it('still lets a caller stage a named antagonist', () => {
			const named = randomCharacter({ isBoss: true, name: 'Lady Vex' });

			expect(named.givenName).to.equal('Lady Vex');
		});
	});
});

describe('isBossFiller', () => {
	// Bosses drop filler by class, not a hand-written list that newer basics got past
	// (roadmap 33). Monster-specific powers in the same classes stay.
	it('drops the plain Hit and unrestricted heal, hide, and boost cards', async () => {
		const { isBossFiller } = await import('./random.js');
		const filler = await Promise.all(
			[
				['../../cards/heal.js', 'HealCard'],
				['../../cards/scotch.js', 'ScotchCard'],
				['../../cards/whiskey-shot.js', 'WhiskeyShotCard'],
				['../../cards/flee.js', 'FleeCard'],
				['../../cards/boost.js', 'BoostCard'],
				['../../cards/basic-shield.js', 'BasicShieldCard'],
				['../../cards/hit.js', 'HitCard'],
			].map(async ([path, name]) => new (await import(path))[name]()),
		);
		for (const card of filler) expect(isBossFiller(card), card.cardType).to.equal(true);
	});

	it('keeps monster-specific powers and every attack but the plain Hit', async () => {
		const { isBossFiller } = await import('./random.js');
		const kept = await Promise.all(
			[
				['../../cards/ecdysis.js', 'EcdysisCard'],
				['../../cards/thick-skin.js', 'ThickSkinCard'],
				['../../cards/gloaming-rest.js', 'GloamingRestCard'],
				['../../cards/horn-of-proof.js', 'HornOfProofCard'],
				['../../cards/sandstorm.js', 'SandstormCard'],
				['../../cards/molasses.js', 'MolassesCard'],
				// A Survival Knife: an attack that also heals, not a heal.
				['../../cards/turkey-thigh.js', 'TurkeyThighCard'],
			].map(async ([path, name]) => new (await import(path))[name]()),
		);
		for (const card of kept) expect(isBossFiller(card), card.cardType).to.equal(false);
	});
});

describe('boss decks and hands', () => {
	// The last refill of a boss deck, and a hand's extra cards, used to skip the filler
	// filter, so bosses still held Hits and heals (a Codex review of PR #407).
	it('never hold filler after the refills', async () => {
		await helpersReady;
		const { isBossFiller } = await import('./random.js');
		for (let i = 0; i < 40; i += 1) {
			const boss = randomCharacter({ isBoss: true });
			const held = [...boss.deck, ...boss.monsters.flatMap((monster: any) => monster.cards)];
			const filler = held.filter((card: any) => isBossFiller(card)).map((card: any) => card.cardType);
			expect(filler, `boss ${i}`).to.deep.equal([]);
		}
	});
});

