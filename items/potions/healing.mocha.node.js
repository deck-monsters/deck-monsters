/* eslint-disable max-len */

const { expect, sinon } = require('../../shared/test-setup');

const Potion = require('./healing');
const randomCharacter = require('../../characters/helpers/random');

describe('./items/healing.js', () => {
	let clock;
	let potion;
	let character;
	let monster;

	const channelStub = sinon.stub();
	const channelName = 'CHANNEL';

	beforeEach(() => {
		potion = new Potion();
		character = randomCharacter({ name: 'Character', coins: 500, gender: 'female' });
		character.addItem(potion);
		monster = character.monsters[0];
		clock = sinon.useFakeTimers();
		channelStub.resolves();
	});

	afterEach(() => {
		clock.restore();
		channelStub.reset();
	});

	it('can heal a living monster', () => {
		expect(character.items.length).to.equal(1);
		monster.hp = 1;
		return potion.use({ channel: channelStub, channelName, character, monster })
			.then(() => {
				expect(monster.hp).to.equal(9);
				return expect(character.items.length).to.equal(0);
			});
	});

	it('can not heal dead monster', () => {
		expect(character.items.length).to.equal(1);
		monster.die();
		return potion.use({ channel: channelStub, channelName, character, monster })
			.then(() => {
				expect(monster.hp).to.equal(0);
				return expect(character.items.length).to.equal(1);
			});
	});
});
