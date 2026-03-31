import { expect } from 'chai';
import sinon from 'sinon';

import { SortingHat } from './sorting-hat.js';

const makeCharacter = (overrides: Record<string, unknown> = {}) => ({
	givenName: 'Character',
	pronouns: { he: 'she', him: 'her', his: 'her' },
	team: undefined as string | undefined,
	items: [] as any[],
	removeItem: (item: any) => {},
	...overrides
});

const makeMonster = (overrides: Record<string, unknown> = {}) => ({
	givenName: 'Monster',
	pronouns: { he: 'she', him: 'her', his: 'her' },
	team: undefined as string | undefined,
	removeItem: sinon.stub().returns(false),
	...overrides
});

describe('./items/scrolls/sorting-hat.ts', () => {
	let clock: sinon.SinonFakeTimers;
	const channelStub = sinon.stub();
	const channelName = 'CHANNEL';

	beforeEach(() => {
		clock = sinon.useFakeTimers();
		channelStub.resolves();
	});

	afterEach(() => {
		clock.restore();
		channelStub.reset();
	});

	it('can assign a team to a character', () => {
		const sortingHat = new SortingHat();
		const character = makeCharacter({ name: 'Character' });

		// Resolve answer index 3 → Slytherin (4th team)
		channelStub.resolves(3);

		expect(character.team).to.equal(undefined);

		return sortingHat.use({ channel: channelStub, channelName, character }).then(() => {
			expect(character.team).to.be.a('string');
		});
	});

	it('can assign a team to a monster', () => {
		const sortingHat = new SortingHat();
		const character = makeCharacter({ name: 'Character' });
		const monster = makeMonster({ givenName: 'Monster' });

		channelStub.resolves('3');

		expect(character.team).to.equal(undefined);
		expect(monster.team).to.equal(undefined);

		return sortingHat.use({ channel: channelStub, channelName, character, monster }).then(() => {
			expect(character.team).to.equal(undefined);
			return expect(monster.team).to.be.a('string');
		});
	});
});
