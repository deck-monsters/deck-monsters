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

const ringAnnouncer = { channel: what => announcer('THE_RING', what), channelName: 'THE_RING' };
const worldAnnouncer = { channel: what => announcer('THE_WORLD', what), channelName: 'THE_WORLD' };
const slackdem = new Game([ringAnnouncer, worldAnnouncer], { spawnBosses: false }, console.log); // eslint-disable-line no-console


const VLAD_ID = 1234;
const vladAnnouncer = what => announcer('vlad', what);
let vlad;
let vladCards;

const CHAR_ID = 861;
const charAnnouncer = what => announcer('charlemagne', what);
let char;
let charCards;


return Promise
	.resolve()
	.then(() => slackdem.getCharacter(vladAnnouncer, VLAD_ID, {
		id: VLAD_ID, name: 'vlad', type: 0, gender: 1, icon: 0, xp: 100
	}))
	.then((character) => {
		vlad = character;
		vladCards = [...shuffle(vlad.character.deck).slice(0, 7)];
	})
	.then(() => slackdem.getCharacter(charAnnouncer, CHAR_ID, {
		id: CHAR_ID, name: 'charlemagne', type: 0, gender: 1, icon: 0, xp: 200
	}))
	.then((character) => {
		char = character;
		charCards = [...shuffle(char.character.deck).slice(0, 7)];
		// const destroy = new DestroyCard();
		// charCards = [destroy, destroy, destroy, destroy];
	})
	.then(() => vlad.spawnMonster({
		type: 0, name: 'jerry', color: 'gray', gender: 1, cards: vladCards, xp: 100
	}))
	.then(() => vlad.spawnMonster({
		type: 1, name: 'qed', color: 'gray', gender: 0, cards: vladCards, xp: 100
	}))
	.then(() => char.spawnMonster({
		type: 2, name: 'tom', color: 'brown', gender: 0, cards: charCards, xp: 200
	}))
	.then(() => char.spawnMonster({
		type: 3, name: 'dbb', color: 'brown', gender: 0, cards: charCards, xp: 200
	}))
	.then(() => vlad.sendMonsterExploring())
	.then(() => char.sendMonsterExploring());

