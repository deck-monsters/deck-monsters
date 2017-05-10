const delayTimes = require('./delay-times.js');

const Channel = (publicChannel) => {
	this.publicChannel = publicChannel;

	const queue = [];

	const sendMessages = () => {
		const { announce, delay } = queue.shift() || { announce: undefined, delay: 'long' };

		const delayMS = {
			short: delayTimes.shortDelay(),
			medium: delayTimes.mediumDelay(),
			long: delayTimes.longDelay()
		};

		if (announce) {
			this.publicChannel({ announce });
		}

		setTimeout(sendMessages, delayMS[delay]);
	};

	sendMessages();

	return ({ announce, delay = 'medium' }) => {
		queue.push({ announce, delay });
	};
};


module.exports = Channel;
