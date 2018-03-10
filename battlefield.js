// A Battlefield

const prompt = require('prompt'); // eslint-disable-line node/no-unpublished-require
const shuffle = require('lodash.shuffle');

const { Game } = require('./index.js');
const pause = require('./helpers/pause');

const { THE_WORLD, MAIN_RING } = require('./helpers/channel-names');

// const DestroyCard = require('./cards/destroy.js');

pause.getThrottleRate = () => 5;
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

const ringAnnouncer = { channel: what => announcer(MAIN_RING, what), channelName: MAIN_RING };
const worldAnnouncer = { channel: what => announcer(THE_WORLD, what), channelName: THE_WORLD };

const slackdem = new Game({ mainRing: ringAnnouncer, theWorld: worldAnnouncer }, { spawnBosses: false }, console.log); // eslint-disable-line no-console

const VLAD_ID = 1234;
const vladAnnouncer = what => announcer('vlad', what);
const vladUser = { id: VLAD_ID, name: 'vlad' };
const vladOptions = { user: vladUser, channel: vladAnnouncer, channelName: 'vlad', isDM: true };
let vlad;
let vladCards;

const CHAR_ID = 861;
const charAnnouncer = what => announcer('charlemagne', what);
const charUser = { id: CHAR_ID, name: 'charlemagne' };
const charOptions = { user: charUser, channel: charAnnouncer, channelName: 'charlemagne', isDM: true };
let char;
let charCards;

return Promise
	.resolve()
	.then(() => slackdem.getCharacter({
		...vladOptions, ...vladUser, type: 0, gender: 1, icon: 0, xp: 100
	}))
	.then((character) => {
		vlad = character;
		vlad.coins = 1000;
		vladCards = [...shuffle(vlad.deck).slice(0, 9)];
	})
	.then(() => slackdem.getCharacter({
		...charOptions, ...charUser, type: 0, gender: 1, icon: 0, xp: 200
	}))
	.then((character) => {
		char = character;
		char.coins = 1000;
		charCards = [...shuffle(char.deck).slice(0, 9)];
	})
	.then(() => slackdem.handleCommand({ command: 'spawn a monster' })({
		...vladOptions, type: 0, name: 'jerry', color: 'gray', gender: 1, cards: vladCards, xp: 301
	}))
	.then(() => slackdem.handleCommand({ command: 'spawn a monster' })({
		...vladOptions, type: 1, name: 'qed', color: 'gray', gender: 2, cards: vladCards, xp: 302
	}))
	.then(() => slackdem.handleCommand({ command: 'spawn a monster' })({
		...charOptions, type: 2, name: 'tom', color: 'brown', gender: 0, cards: charCards, xp: 303
	}))
	.then(() => slackdem.handleCommand({ command: 'spawn a monster' })({
		...charOptions, type: 3, name: 'dbb', color: 'brown', gender: 0, cards: charCards, xp: 304
	}))
	.then(() => slackdem.handleCommand({ command: 'spawn a monster' })({
		...charOptions, type: 4, name: 'king', color: 'brown', gender: 1, cards: charCards, xp: 305
	}))
	.then(() => slackdem.handleCommand({ command: 'look at card brain drain' })({
		...vladOptions
	}))
	.then(() => slackdem.handleCommand({ command: 'look at character rankings' })({
		...vladOptions
	}))
	.then(() => slackdem.handleCommand({ command: 'look at monster rankings' })({
		...vladOptions
	}))
	.then(() => slackdem.handleCommand({ command: 'send a monster to the ring' })({
		...vladOptions
	}))
	.then(() => slackdem.handleCommand({ command: 'send a monster to the ring' })({
		...charOptions
	}))
	.then(() => slackdem.getRing().spawnBoss())
	.then(() => slackdem.getRing().spawnBoss())
	.catch(err => console.error(err)); // eslint-disable-line no-console
