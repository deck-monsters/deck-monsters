/* eslint-disable max-len */

const { expect, sinon } = require('../../shared/test-setup');

const randomCharacter = require('../../characters/helpers/random');
const SortingHat = require('./sorting-hat');

describe('./items/sorting-hat.js', () => {
	let clock;

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
		const character = randomCharacter({ name: 'Character', coins: 500, gender: 'female' });

		channelStub.withArgs({
			choices: ['0', '1', '2', '3'],
			question: `"Hmm," says a small voice in Character's ear. "Difficult. Very difficult. Plenty of courage, I see. Not a bad mind either. There’s talent, oh my goodness, yes — and a nice thirst to prove yourself, now that’s interesting. . . . So where shall I put you?"

0) Gryffindor
1) Hufflepuff
2) Ravenclaw
3) Slytherin`
		})
			.resolves(3);

		expect(character.team).to.equal(undefined);

		return sortingHat.use({ channel: channelStub, channelName, character })
			.then(() => expect(character.team).to.equal('Slytherin'));
	});

	it('can assign a team to a monster', () => {
		const sortingHat = new SortingHat();
		const character = randomCharacter({ name: 'Character', coins: 500, gender: 'female' });

		const monster = character.monsters[0];
		monster.optionsStore.name = 'Monster';

		channelStub.withArgs({
			choices: ['0', '1', '2', '3'],
			question: `"Hmm," says a small voice in Monster's ear. "Difficult. Very difficult. Plenty of courage, I see. Not a bad mind either. There’s talent, oh my goodness, yes — and a nice thirst to prove yourself, now that’s interesting. . . . So where shall I put you?"

0) Gryffindor
1) Hufflepuff
2) Ravenclaw
3) Slytherin`
		})
			.resolves('3');

		expect(character.team).to.equal(undefined);
		expect(monster.team).to.equal(undefined);

		return sortingHat.use({ channel: channelStub, channelName, character, monster })
			.then(() => {
				expect(character.team).to.equal(undefined);
				return expect(monster.team).to.equal('Slytherin');
			});
	});
});
