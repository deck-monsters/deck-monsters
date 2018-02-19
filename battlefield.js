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
		vlad.character.coins = 1000;
		vladCards = [...shuffle(vlad.character.deck).slice(0, 9)];
	})
	.then(() => slackdem.getCharacter(charAnnouncer, CHAR_ID, {
		id: CHAR_ID, name: 'charlemagne', type: 0, gender: 1, icon: 0, xp: 200
	}))
	.then((character) => {
		char = character;
		char.character.coins = 1000;
		charCards = [...shuffle(char.character.deck).slice(0, 9)];
		// const destroy = new DestroyCard();
		// charCards = [destroy, destroy, destroy, destroy];
	})
	// .then(() => vlad.spawnMonster())
	.then(() => vlad.spawnMonster({
		type: 0, name: 'jerry', color: 'gray', gender: 1, cards: vladCards, xp: 300
	}))
	// .then(() => vlad.equipMonster({ monsterName: 'jerry', cardSelection: 'brain drain, pick pocket, hit' }));
	.then(() => vlad.spawnMonster({
		type: 1, name: 'qed', color: 'gray', gender: 2, cards: vladCards, xp: 300
	}))
	.then(() => char.spawnMonster({
		type: 2, name: 'tom', color: 'brown', gender: 0, cards: charCards, xp: 300
	}))
	.then(() => char.spawnMonster({
		type: 3, name: 'dbb', color: 'brown', gender: 0, cards: charCards, xp: 300
	}))
	.then(() => char.spawnMonster({
		type: 4, name: 'king', color: 'brown', gender: 1, cards: charCards, xp: 300
	}))
	// .then(() => vlad.character.monsters[0].die())
	// .then(() => vlad.buyItems())
	// .then(() => vlad.giveItemsToMonster())
	// .then(() => vlad.useItems())
	// .then(() => vlad.useItemsOnMonster())
	.then(() => vlad.lookAtCard({ cardName: 'brain drain' }))
	.then(() => vlad.lookAtItem({ itemName: 'the way of the cobra kai' }))
	.then(() => vlad.lookAtItems())
	.then(() => vlad.lookAtCards())
	.then(() => vlad.lookAt('player handbook'))
	.then(() => vlad.lookAt('dungeon master guide'))
	.then(() => vlad.lookAt('monster manual'))
	.then(() => vlad.lookAtMonster({ monsterName: 'jerry' }))
	// .then(() => vlad.useItemsOnMonster())
	.then(() => vlad.sendMonsterToTheRing())
	.then(() => char.sendMonsterToTheRing())
	.then(() => slackdem.getRing().spawnBoss())
	.then(() => slackdem.getRing().spawnBoss());
