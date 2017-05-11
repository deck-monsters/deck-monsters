const delayTimes = require('./delay-times.js');

const Channel = (channel, logger = () => {}) => {
	this.channel = channel;

	const queue = [];

	const sendMessages = () => Promise
		.resolve()
		.then(() => {
			const item = queue.shift();

			if (item) {
				const { announce, question, choices, delay } = item;

				return this.channel({ announce, question, choices })
					.then(() => ({ delay }));
			}

			return Promise.resolve();
		})
		.then(({ delay = 'medium' } = {}) => {
			const delayMS = {
				short: delayTimes.shortDelay(),
				medium: delayTimes.mediumDelay(),
				long: delayTimes.longDelay()
			};

			return setTimeout(sendMessages, delayMS[delay]);
		})
		.catch((err) => {
			logger(err);
			sendMessages();
		});

	sendMessages();

	return ({ announce, question, choices, delay = 'medium' }) => {
		queue.push({ announce, question, choices, delay });
	};
};


module.exports = Channel;
