const delayTimes = require('./delay-times.js');

const Channel = (publicChannel) => {
	this.publicChannel = publicChannel;

	const queue = [];

	const sendMessages = () => {
		const { announce, delay } = queue.shift() || { announce: undefined, delay: delayTimes.longDelay() };


		if (announce) {
			this.publicChannel({ announce });
		}

		setTimeout(sendMessages, delay);
	};

	sendMessages();

	return ({ announce, delay = delayTimes.mediumDelay() }) => {
		queue.push({ announce, delay });
	};
};


module.exports = Channel;
