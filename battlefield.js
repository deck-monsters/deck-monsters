// A Battlefield

const prompt = require('prompt'); // eslint-disable-line node/no-unpublished-require
const shuffle = require('lodash.shuffle');

const { Game } = require('./index.js');
const pause = require('./helpers/pause');

// const DestroyCard = require('./cards/destroy.js');

pause.setTimeout = func => setTimeout(func, 5);

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
		reject('Invalid arguments supplied to the channel'); // eslint-disable-line prefer-promise-reject-errors
	}
});

const roomAnnouncer = what => announcer('Room', what);
const slackdem = new Game(roomAnnouncer, { spawnBosses: false }, console.log); // eslint-disable-line no-console

const VLAD_ID = 1234;
const vladAnnouncer = what => announcer('vlad', what);
let vlad;
let vladCards;

const CHAR_ID = 861;
const charAnnouncer = what => announcer('charlemagne', what);
let char;
let charCards;

// const BOSS_ID = 666;
// const bossAnnouncer = what => announcer('boss', what);
// let boss;
// let bossCards;

return Promise
	.resolve()
	.then(() => slackdem.getCharacter(vladAnnouncer, VLAD_ID, {
		id: VLAD_ID, name: 'vlad', type: 0, gender: 1, icon: 0, xp: 100
	}))
	.then((character) => {
		vlad = character;
		vladCards = [...shuffle(vlad.character.deck).slice(0, 9)];
	})
	.then(() => slackdem.getCharacter(charAnnouncer, CHAR_ID, {
		id: CHAR_ID, name: 'charlemagne', type: 0, gender: 1, icon: 0, xp: 200
	}))
	.then((character) => {
		char = character;
		charCards = [...shuffle(char.character.deck).slice(0, 9)];
		// const destroy = new DestroyCard();
		// charCards = [destroy, destroy, destroy, destroy];
	})
	// .then(() => vlad.spawnMonster())
	.then(() => vlad.spawnMonster({
		type: 0, name: 'jerry', color: 'gray', gender: 1, cards: vladCards, xp: 100
	}))
	// .then(() => vlad.equipMonster({ monsterName: 'jerry', cardSelection: 'brain drain, pick pocket, hit' }));
	.then(() => vlad.spawnMonster({
		type: 1, name: 'qed', color: 'gray', gender: 2, cards: vladCards, xp: 100
	}))
	.then(() => char.spawnMonster({
		type: 2, name: 'tom', color: 'brown', gender: 0, cards: charCards, xp: 200
	}))
	.then(() => char.spawnMonster({
		type: 3, name: 'dbb', color: 'brown', gender: 0, cards: charCards, xp: 200
	}))
	.then(() => vlad.lookAtCard({ cardName: 'brain drain' }))
	.then(() => vlad.lookAtCard({ cardName: 'pick pocket' }))
	.then(() => vlad.lookAtCards())
	.then(() => vlad.lookAt('player handbook'))
	.then(() => vlad.lookAtMonster({ monsterName: 'jerry' }))
	.then(() => vlad.sendMonsterToTheRing())
	.then(() => char.sendMonsterToTheRing())
	.then(() => slackdem.getRing().spawnBoss())
