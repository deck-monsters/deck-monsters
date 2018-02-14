/* eslint-disable max-len */

const { expect, sinon } = require('../../shared/test-setup');

const SpinUp = require('./spin-up');
const randomCharacter = require('../../characters/helpers/random');

describe('./items/spin-up.js', () => {
	let clock;
	let spinUp;
	let character;
	let monster;

	const channelStub = sinon.stub();
	const channelName = 'CHANNEL';

	beforeEach(() => {
		spinUp = new SpinUp();
		character = randomCharacter({ name: 'Character', coins: 500, gender: 'female' });
		character.addItem(spinUp);
		monster = character.monsters[0];
		clock = sinon.useFakeTimers();
		channelStub.resolves();
	});

	afterEach(() => {
		clock.restore();
		channelStub.reset();
	});

	it('can not heal a living monster', () => {
		expect(character.items.length).to.equal(1);
		monster.hp = 1;
		return spinUp.use({ channel: channelStub, channelName, character, monster })
			.then(() => {
				expect(monster.hp).to.equal(1);
				return expect(character.items.length).to.equal(1);
			});
	});

	it('can revive dead monster', () => {
		expect(character.items.length).to.equal(1);
		monster.die();
		return spinUp.use({ channel: channelStub, channelName, character, monster })
			.then(() => {
				expect(monster.hp).to.be.above(0);
				return expect(character.items.length).to.equal(0);
			});
	});

	it('can not revive dead monster who is in an encounter', () => {
		expect(character.items.length).to.equal(1);
		monster.inEncounter = true;
		monster.die();
		return spinUp.use({ channel: channelStub, channelName, character, monster })
			.then(() => {
				expect(monster.hp).to.equal(0);
				return expect(character.items.length).to.equal(1);
			});
	});
});
