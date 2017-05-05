// A Battlefield

const prompt = require('prompt');
const Game = require('./index.js');

prompt.start();

const announcer = what => new Promise((resolve, reject) => {
	if (what.announce) {
		console.log(what.announce);

		resolve(what);
	} else if (what.question) {
		const question = {
			description: what.question,
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

const slackdem = new Game(announcer);

const vlad = slackdem.getPlayer({ id: 1234, name: 'vlad' });
const char = slackdem.getPlayer({ id: 861, name: 'charlemagne' });

Promise
	.resolve()
	.then(() => vlad.spawnMonster(announcer))
	.then(() => char.spawnMonster(announcer));
