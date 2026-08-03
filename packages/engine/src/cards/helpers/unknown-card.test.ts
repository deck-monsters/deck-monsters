import { expect } from 'chai';

describe('cards/helpers/unknown-card.ts', () => {
	const serialized = {
		name: 'DeletedCard_XYZ',
		options: { icon: '🔥', customFlag: true, used: 2 },
	};

	it('preserves the original serialized name and options for repair', async () => {
		const { UnknownCard } = await import('./unknown-card.js');
		const card = new UnknownCard(serialized);

		expect(card.name).to.equal('DeletedCard_XYZ');
		expect(card.toJSON()).to.deep.equal(serialized);
	});

	it('is visible as an unknown placeholder rather than a random known card', async () => {
		const { UnknownCard } = await import('./unknown-card.js');
		const card = new UnknownCard(serialized);

		expect(card.cardType).to.include('Unknown');
		expect(card.cardType).to.include('DeletedCard_XYZ');
		expect(card.description).to.match(/could not be restored|missing|unknown/i);
	});

	it('plays as an inert no-op that does not throw', async () => {
		const { UnknownCard } = await import('./unknown-card.js');
		const card = new UnknownCard(serialized);
		const player = { givenName: 'Test', pronouns: { his: 'his', he: 'he', him: 'him' } };

		const result = await card.play(player, player, undefined, undefined, false);

		expect(result).to.equal(true);
	});

	it('round-trips through hydrateCard without becoming a random draw', async () => {
		const { UnknownCard } = await import('./unknown-card.js');
		const { hydrateCard } = await import('./hydrate.js');

		const card = hydrateCard(serialized);
		const again = hydrateCard(card.toJSON());

		expect(card).to.be.instanceOf(UnknownCard);
		expect(again).to.be.instanceOf(UnknownCard);
		expect(card.toJSON()).to.deep.equal(serialized);
		expect(again.toJSON()).to.deep.equal(serialized);
		expect(card.name).to.equal('DeletedCard_XYZ');
	});
});
