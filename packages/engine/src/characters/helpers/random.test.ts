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
