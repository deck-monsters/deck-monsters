const Game = require('./index.js');

const announcer = (what) => {
	console.log(what.announce);
};

const slackdem = new Game(announcer);

