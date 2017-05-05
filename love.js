// A Battlefield

const Game = require('./index.js');

const announcer = (what) => {
	console.log(what.announce);
};

const slackdem = new Game(announcer);

const vlad = slackdem.getPlayer({ id: 1234, name: 'vlad' });
const char = slackdem.getPlayer({ id: 861, name: 'charlemagne' });

vlad.spawnMonster(announcer);
char.spawnMonster(announcer);
