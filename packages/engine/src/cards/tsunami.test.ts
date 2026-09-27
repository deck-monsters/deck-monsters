import { expect } from 'chai';

import { TsunamiCard, TSUNAMI_DAMAGE } from './tsunami.js';
import { TakeWingCard, isAirborne } from './take-wing.js';
import { hydrateCard } from './helpers/hydrate.js';
import Dragon from '../monsters/dragon.js';
import Minotaur from '../monsters/minotaur.js';
import Unicorn from '../monsters/unicorn.js';
import { DRAGON } from '../constants/creature-types.js';
import { AOE } from '../constants/card-classes.js';

describe('./cards/tsunami.ts Tsunami', () => {
	let dragon: any;
	let ally: any;
	let foe: any;
	let ring: any;
	let contestants: any[];

	beforeEach(() => {
		dragon = new Dragon({ name: 'Skarn', gender: 'male' });
		ally = new Unicorn({ name: 'Nola' });
		foe = new Minotaur({ name: 'Bram' });
		contestants = [dragon, ally, foe].map(monster => ({ monster, character: {} }));
		ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		for (const { monster } of contestants) monster.startEncounter(ring);
	});

	it('is an epic, Dragon-only area card from the back room', () => {
		expect(TsunamiCard.permittedClassesAndTypes).to.deep.equal([DRAGON]);
		expect(TsunamiCard.notForSale).to.equal(true);
		expect(new TsunamiCard().isCardClass(AOE)).to.equal(true);
		expect(foe.canHoldCard(TsunamiCard)).to.equal(false);
	});

	it('does 5 damage to everyone in the ring, the dragon last', async () => {
		const before = contestants.map(({ monster }) => monster.hp);

		expect(new TsunamiCard().getTargets(dragon, foe, ring, contestants)).to.deep.equal([ally, foe, dragon]);
		await new TsunamiCard().play(dragon, foe, ring, contestants);

		contestants.forEach(({ monster }, i) => expect(monster.hp, monster.givenName).to.equal(before[i] - TSUNAMI_DAMAGE));
	});

	it('says the wave comes back for the dragon, not that he hit himself by mistake', async () => {
		const card = new TsunamiCard();
		const seen: string[] = [];
		dragon.on('hit', (_c: string, _m: any, { card: hitCard }: any) => seen.push(hitCard.flavorText));

		await card.play(dragon, foe, ring, contestants);

		expect(seen[0]).to.include('The wave comes back for Skarn too: 5 damage.');
		expect((card as any).flavorText).to.equal(undefined);
	});

	it('knocks a flying foe out of the sky, since a wave cannot be dodged', async () => {
		const flyer = new Dragon({ name: 'Vessa' });
		flyer.startEncounter(ring);
		const withFlyer = [...contestants, { monster: flyer, character: {} }];
		await new TakeWingCard().play(flyer, flyer, ring, withFlyer);
		expect(isAirborne(flyer)).to.equal(true);

		await new TsunamiCard().play(dragon, foe, ring, withFlyer);

		expect(isAirborne(flyer)).to.equal(false);
	});

	it('survives a JSON hydration round trip', () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new TsunamiCard())));
		expect(restored).to.be.instanceOf(TsunamiCard);
	});
});
