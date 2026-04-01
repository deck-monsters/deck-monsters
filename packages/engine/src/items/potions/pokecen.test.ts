import { expect } from 'chai';
import sinon from 'sinon';

import { Pokecen } from './pokecen.js';

const makeMonster = (overrides: Record<string, unknown> = {}) => ({
	givenName: 'Monster',
	pronouns: { he: 'he', him: 'him', his: 'his' },
	dead: false,
	inEncounter: false,
	hp: 10,
	maxHp: 18,
	heal: sinon.stub(),
	removeItem: sinon.stub().returns(false),
	...overrides
});

const makeCharacter = (overrides: Record<string, unknown> = {}) => {
	const items: any[] = [];

	return {
		givenName: 'Character',
		pronouns: { he: 'she', him: 'her', his: 'her' },
		items,
		addItem(item: any) { items.push(item); },
		removeItem(item: any) {
			const index = items.indexOf(item);
			if (index > -1) items.splice(index, 1);
		},
		...overrides
	};
};

describe('./items/potions/pokecen.ts', () => {
	let clock: sinon.SinonFakeTimers;
	const channelStub = sinon.stub();
	const channelName = 'CHANNEL';

	beforeEach(() => {
		clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
		channelStub.resolves();
	});

	afterEach(() => {
		clock.restore();
		channelStub.reset();
	});

	it('can heal a living monster', () => {
		const pokecen = new Pokecen();
		const character = makeCharacter();
		character.addItem(pokecen);
		const monster = makeMonster({ hp: 1, maxHp: 18 });
		(monster.heal as sinon.SinonStub).callsFake((amount: number) => { monster.hp += amount; });

		expect(character.items.length).to.equal(1);

		return pokecen.use({ channel: channelStub, channelName, character, monster }).then(() => {
			expect((monster.heal as sinon.SinonStub).calledWith(17)).to.equal(true);
			return expect(character.items.length).to.equal(0);
		});
	});

	it('can not heal dead monster', () => {
		const pokecen = new Pokecen();
		const character = makeCharacter();
		character.addItem(pokecen);
		const monster = makeMonster({ dead: true, hp: 0 });

		expect(character.items.length).to.equal(1);

		return pokecen.use({ channel: channelStub, channelName, character, monster }).then(() => {
			expect((monster.heal as sinon.SinonStub).called).to.equal(false);
			return expect(character.items.length).to.equal(1);
		});
	});

	it('can not heal monster in encounter', () => {
		const pokecen = new Pokecen();
		const character = makeCharacter();
		character.addItem(pokecen);
		const monster = makeMonster({ inEncounter: true, hp: 1 });

		expect(character.items.length).to.equal(1);

		return pokecen.use({ channel: channelStub, channelName, character, monster }).then(() => {
			expect((monster.heal as sinon.SinonStub).called).to.equal(false);
			return expect(character.items.length).to.equal(1);
		});
	});
});
