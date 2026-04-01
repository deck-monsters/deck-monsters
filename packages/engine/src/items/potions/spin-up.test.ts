import { expect } from 'chai';
import sinon from 'sinon';

import { SpinUp } from './spin-up.js';

const makeMonster = (overrides: Record<string, unknown> = {}) => ({
	givenName: 'Monster',
	pronouns: { he: 'he', him: 'him', his: 'his' },
	dead: false,
	inEncounter: false,
	hp: 10,
	maxHp: 18,
	heal: sinon.stub(),
	respawn: sinon.stub(),
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

describe('./items/potions/spin-up.ts', () => {
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

	it('can not heal a living monster', () => {
		const spinUp = new SpinUp();
		const character = makeCharacter();
		character.addItem(spinUp);
		const monster = makeMonster({ dead: false, hp: 1 });

		expect(character.items.length).to.equal(1);

		return spinUp.use({ channel: channelStub, channelName, character, monster }).then(() => {
			expect((monster.heal as sinon.SinonStub).called).to.equal(false);
			return expect(character.items.length).to.equal(1);
		});
	});

	it('can revive dead monster', () => {
		const spinUp = new SpinUp();
		const character = makeCharacter();
		character.addItem(spinUp);
		const monster = makeMonster({ dead: true, hp: 0, maxHp: 18 });
		(monster.respawn as sinon.SinonStub).callsFake(() => { monster.dead = false; });
		(monster.heal as sinon.SinonStub).callsFake((amount: number) => { monster.hp += amount; });

		expect(character.items.length).to.equal(1);

		return spinUp.use({ channel: channelStub, channelName, character, monster }).then(() => {
			expect((monster.respawn as sinon.SinonStub).called).to.equal(true);
			expect((monster.heal as sinon.SinonStub).called).to.equal(true);
			return expect(character.items.length).to.equal(0);
		});
	});

	it('can not revive dead monster who is in an encounter', () => {
		const spinUp = new SpinUp();
		const character = makeCharacter();
		character.addItem(spinUp);
		const monster = makeMonster({ dead: true, inEncounter: true, hp: 0 });

		expect(character.items.length).to.equal(1);

		return spinUp.use({ channel: channelStub, channelName, character, monster }).then(() => {
			expect((monster.heal as sinon.SinonStub).called).to.equal(false);
			return expect(character.items.length).to.equal(1);
		});
	});
});
