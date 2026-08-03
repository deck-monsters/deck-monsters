import { expect } from 'chai';

import { UnknownCard } from './unknown-card.js';
import { hydrateCard } from './hydrate.js';
import { matchesCardLookupName } from './matches-lookup-name.js';
import { HitCard } from '../hit.js';

describe('cards/helpers/unknown-card.ts', () => {
	const serialized = {
		name: 'DeletedCard_XYZ',
		options: { icon: '🔥', customFlag: true, used: 2 },
	};

	it('preserves the original serialized name and options for repair', () => {
		const card = new UnknownCard(serialized);

		expect(card.name).to.equal('DeletedCard_XYZ');
		expect(card.toJSON()).to.deep.equal(serialized);
	});

	it('is visible as an unknown placeholder rather than a random known card', () => {
		const card = new UnknownCard(serialized);

		expect(card.cardType).to.include('Unknown');
		expect(card.cardType).to.include('DeletedCard_XYZ');
		expect(card.description).to.match(/could not be restored|missing|unknown/i);
	});

	it('plays as an inert no-op on the default applyEffects path without crashing', async () => {
		const card = new UnknownCard(serialized);
		const player = {
			givenName: 'Test',
			pronouns: { his: 'his', he: 'he', him: 'him' },
			encounterEffects: [],
		};
		const target = {
			givenName: 'Foe',
			pronouns: { his: 'his', he: 'he', him: 'him' },
			encounterEffects: [],
		};

		// Default shouldApplyEffects=true — the production combat path
		const result = await card.play(player, target, { encounterEffects: [] }, [
			{ monster: player },
			{ monster: target },
		]);

		expect(result).to.equal(true);
	});

	it('round-trips through hydrateCard without becoming a random draw', () => {
		const card = hydrateCard(serialized);
		const again = hydrateCard(card.toJSON());

		expect(card).to.be.instanceOf(UnknownCard);
		expect(again).to.be.instanceOf(UnknownCard);
		expect(card.toJSON()).to.deep.equal(serialized);
		expect(again.toJSON()).to.deep.equal(serialized);
		expect(card.name).to.equal('DeletedCard_XYZ');
	});

	it('preserves an inert placeholder when serialized name is missing (malformed save)', () => {
		const card = hydrateCard({ options: { kept: true } } as any);

		expect(card).to.be.instanceOf(UnknownCard);
		expect(card.play).to.be.a('function');
		expect(card.cardType).to.include('Unknown');
		expect(card.toJSON().options).to.deep.equal({ kept: true });
		expect(card.toJSON().name).to.be.a('string').and.not.equal('HitCard');
	});
});

describe('cards/helpers/matches-lookup-name.ts', () => {
	it('matches UnknownCard by visible cardType or original serialized class name', () => {
		const unknown = new UnknownCard({
			name: 'LegacyRemovedCard',
			options: { kept: 'yes' },
		});

		expect(matchesCardLookupName(unknown, 'Unknown Card (LegacyRemovedCard)')).to.equal(true);
		expect(matchesCardLookupName(unknown, 'LegacyRemovedCard')).to.equal(true);
		expect(matchesCardLookupName(unknown, 'legacyremovedcard')).to.equal(true);
		expect(matchesCardLookupName(unknown, 'Hit')).to.equal(false);
	});

	it('keeps normal card matching on cardType only (constructor name is not an alias)', () => {
		const hit = new HitCard();

		expect(matchesCardLookupName(hit, 'Hit')).to.equal(true);
		expect(matchesCardLookupName(hit, 'hit')).to.equal(true);
		expect(matchesCardLookupName(hit, 'HitCard')).to.equal(false);
	});
});
