import { expect } from 'chai';
import sinon from 'sinon';

import { HealingPotion } from './healing.js';

const makeMonster = (overrides: Record<string, unknown> = {}) => ({
	givenName: 'Monster',
	pronouns: { he: 'he', him: 'him', his: 'his' },
	dead: false,
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

describe('./items/potions/healing.ts', () => {
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

	it('can heal a living monster', () => {
		const potion = new HealingPotion();
		const character = makeCharacter();
		character.addItem(potion);
		const monster = makeMonster({ hp: 1 });
		(monster.heal as sinon.SinonStub).callsFake((amount: number) => { monster.hp += amount; });

		expect(character.items.length).to.equal(1);

		return potion.use({ channel: channelStub, channelName, character, monster }).then(() => {
			expect((monster.heal as sinon.SinonStub).calledWith(HealingPotion.healAmount)).to.equal(true);
			return expect(character.items.length).to.equal(0);
		});
	});

	it('can not heal dead monster', () => {
		const potion = new HealingPotion();
		const character = makeCharacter();
		character.addItem(potion);
		const monster = makeMonster({ dead: true, hp: 0 });

		expect(character.items.length).to.equal(1);

		return potion.use({ channel: channelStub, channelName, character, monster }).then(() => {
			expect((monster.heal as sinon.SinonStub).called).to.equal(false);
			return expect(character.items.length).to.equal(1);
		});
	});
});
