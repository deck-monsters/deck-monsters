/* eslint-disable max-len */

const { expect, sinon } = require('../../shared/test-setup');

const Pokecen = require('./pokecen');
const randomCharacter = require('../../characters/helpers/random');

describe('./items/pokecen.js', () => {
	let clock;
	let pokecen;
	let character;
	let monster;

	const channelStub = sinon.stub();
	const channelName = 'CHANNEL';

	beforeEach(() => {
		pokecen = new Pokecen();
		character = randomCharacter({ name: 'Character', coins: 500, gender: 'female' });
		character.addItem(pokecen);
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
		return pokecen.use({ channel: channelStub, channelName, character, monster })
			.then(() => {
				expect(monster.hp).to.equal(monster.maxHp);
				return expect(character.items.length).to.equal(0);
			});
	});

	it('can not heal dead monster', () => {
		expect(character.items.length).to.equal(1);
		monster.die();
		return pokecen.use({ channel: channelStub, channelName, character, monster })
			.then(() => {
				expect(monster.hp).to.equal(0);
				return expect(character.items.length).to.equal(1);
			});
	});

	it('can not heal monster in encounter', () => {
		expect(character.items.length).to.equal(1);
		monster.inEncounter = true;
		monster.hp = 1;
		return pokecen.use({ channel: channelStub, channelName, character, monster })
			.then(() => {
				expect(monster.hp).to.equal(1);
				return expect(character.items.length).to.equal(1);
			});
	});
});
