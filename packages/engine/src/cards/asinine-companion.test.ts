import { expect } from 'chai';

import { AsinineCompanionCard } from './asinine-companion.js';
import { BoostCard } from './boost.js';
import { hydrateCard } from './helpers/hydrate.js';
import Dragon from '../monsters/dragon.js';
import Minotaur from '../monsters/minotaur.js';
import { DRAGON } from '../constants/creature-types.js';

describe('./cards/asinine-companion.ts Asinine Companion', () => {
	it('is a level 1 Dragon boost card, hydratable, and not for a Minotaur', () => {
		expect(AsinineCompanionCard.permittedClassesAndTypes).to.deep.equal([DRAGON]);
		expect(AsinineCompanionCard.level).to.equal(1);
		expect(new AsinineCompanionCard()).to.be.instanceOf(BoostCard);
		expect(new Dragon({ xp: 50 }).canHoldCard(AsinineCompanionCard)).to.equal(true);
		expect(new Minotaur({ xp: 50 }).canHoldCard(AsinineCompanionCard)).to.equal(false);
		const restored = hydrateCard(JSON.parse(JSON.stringify(new AsinineCompanionCard())));
		expect(restored).to.be.instanceOf(AsinineCompanionCard);
	});

	it('boosts STR by 2', () => {
		const card = new AsinineCompanionCard();
		expect(card.boostedProp).to.equal('str');
		expect(card.boostAmount).to.equal(2);
		expect(card.stats).to.include('str +2');
	});
});
