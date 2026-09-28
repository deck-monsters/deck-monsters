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

describe('boss hands', () => {
	// A boss never runs and never stalls on heals, but still holds basic cards (owner,
	// roadmap 33): on main about 17% of boss hand slots were basics, a third held a heal.
	const load = async (path: string, name: string) => new (await import(path))[name]();

	it('counts only heals any monster could hold against the cap', async () => {
		const { isPlainHeal } = await import('./random.js');
		for (const [path, name] of [
			['../../cards/heal.js', 'HealCard'],
			['../../cards/scotch.js', 'ScotchCard'],
			['../../cards/whiskey-shot.js', 'WhiskeyShotCard'],
		]) {
			expect(isPlainHeal(await load(path, name)), name).to.equal(true);
		}
		for (const [path, name] of [
			['../../cards/gloaming-rest.js', 'GloamingRestCard'],
			['../../cards/horn-of-proof.js', 'HornOfProofCard'],
			['../../cards/hit.js', 'HitCard'],
			['../../cards/turkey-thigh.js', 'TurkeyThighCard'],
		]) {
			expect(isPlainHeal(await load(path, name)), name).to.equal(false);
		}
	});

	it('picks at most one plain heal and never Flee, keeping the order', async () => {
		const { pickBossHand, BOSS_MAX_HEALS } = await import('./random.js');
		const heal = () => load('../../cards/heal.js', 'HealCard');
		const hit = () => load('../../cards/hit.js', 'HitCard');
		const options = [await heal(), await load('../../cards/flee.js', 'FleeCard'), await hit(), await heal(), await hit()];
		const hand = pickBossHand(options, 9);
		expect(hand.map((card: any) => card.cardType)).to.deep.equal(['Heal', 'Hit', 'Hit']);
		expect(BOSS_MAX_HEALS).to.equal(1);
	});

	it('holds full hands with at most one plain heal and no Flee, and still some basics', async () => {
		// Also covers the refills: the last deck refill and a hand's extra cards used to skip
		// the boss rule (a Codex review of PR #407).
		await helpersReady;
		const { isPlainHeal } = await import('./random.js');
		let basics = 0;
		for (let i = 0; i < 60; i += 1) {
			const boss = randomCharacter({ isBoss: true });
			expect(boss.deck.some((card: any) => card.cardType === 'Flee'), `deck ${i}`).to.equal(false);
			for (const monster of boss.monsters as any[]) {
				expect(monster.cards).to.have.length(monster.cardSlots);
				expect(monster.cards.filter((card: any) => card.cardType === 'Flee')).to.deep.equal([]);
				expect(monster.cards.filter((card: any) => isPlainHeal(card)).length, `hand ${i}`).to.be.at.most(1);
				basics += monster.cards.filter((card: any) => card.cardType === 'Hit' || isPlainHeal(card)).length;
			}
		}
		expect(basics).to.be.above(0);
	});
});
