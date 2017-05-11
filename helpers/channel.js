const delayTimes = require('./delay-times.js');

const Channel = (channel, logger = () => {}) => {
	this.channel = channel;

	const queue = [];

	let lastMsgSent = new Date().getTime();
	const enoughTimeElapsed = (item) => {
		if (new Date().getTime() - lastMsgSent > 5000) {
			return true;
		}

		const nextItem = queue.shift();
		nextItem.announce = `${item.announce}${nextItem.announce}`;
		queue.unshift(nextItem);

		return false;
	};

	const sendMessages = () => Promise
		.resolve()
		.then(() => {
			const item = queue.shift();

			if (item) {
				const { announce, question, choices, delay } = item;

				if ((question || choices) || enoughTimeElapsed(item)) {
					lastMsgSent = new Date().getTime();
					return this.channel({ announce, question, choices })
						.then(() => ({ delay }));
				}
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
