// A Battlefield

const prompt = require('prompt');
const { Game } = require('./index.js');

prompt.start();

const announcer = (prefix, what) => new Promise((resolve, reject) => {
	if (what.announce) {
		console.log(`${prefix} > ${what.announce}`); // eslint-disable-line no-console

		resolve(what);
	} else if (what.question) {
		const question = {
			description: `${prefix} > ${what.question}`,
			required: true
		};

		if (what.choices) {
			question.pattern = new RegExp(what.choices.join('|'), 'i');
		}

		prompt.get({ properties: { question } }, (err, result) => {
			if (err || !result.question) {
				reject(err);
			} else {
				resolve(result.question);
			}
		});
	} else {
		reject('Invalid arguments supplied to the channel');
	}
});

const roomAnnouncer = what => announcer('Room', what);
const slackdem = new Game(roomAnnouncer);

const vladAnnouncer = what => announcer('vlad', what);
let vlad;
let vladCards;

const charAnnouncer = what => announcer('charlemagne', what);
let char;
let charCards;

Promise
	.resolve()
	.then(() => slackdem.getCharacter(vladAnnouncer, { id: 1234, name: 'vlad', type: 0, gender: 1, icon: 0 }))
	.then((character) => {
		vlad = character;
		vladCards = [...vlad.character.deck.slice(0, 2), vlad.character.deck[4]];
	})
	.then(() => slackdem.getCharacter(charAnnouncer, { id: 861, name: 'charlemagne', type: 0, gender: 1, icon: 0 }))
	.then((character) => {
		char = character;
		charCards = [...char.character.deck.slice(0, 2), char.character.deck[4]];
	})
	.then(() => vlad.spawnMonster(vladAnnouncer, { type: 0, name: 'jerry', color: 'gray', gender: 1, cards: vladCards }))
	.then(() => vlad.spawnMonster(vladAnnouncer, { type: 0, name: 'qed', color: 'gray', gender: 2, cards: vladCards }))
	.then(() => char.spawnMonster(charAnnouncer, { type: 1, name: 'tom', color: 'brown', gender: 0, cards: charCards }))
	.then(() => char.spawnMonster(charAnnouncer, { type: 2, name: 'dbb', color: 'brown', gender: 0, cards: charCards }))
	.then(() => vlad.lookAtCard(vladAnnouncer, { cardName: 'hit' }))
	.then(() => vlad.lookAtMonster(vladAnnouncer, { monsterName: 'jerry' }))
//	.then(() => vlad.spawnMonster(vladAnnouncer))
//	.then(() => char.spawnMonster(charAnnouncer))
//	.then(() => vlad.equipMonster(vladAnnouncer))
//	.then(() => char.equipMonster(charAnnouncer))
	// .then(() => vlad.sendMonsterToTheRing(vladAnnouncer))
	// .then(() => char.sendMonsterToTheRing(charAnnouncer));

