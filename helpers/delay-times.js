const SHORT_DELAY = 1000;
const MEDIUM_DELAY = 1600;
const LONG_DELAY = 2200;
const ONE_MINUTE = 60000;

const delayTimes = {
	shortDelay () {
		return Math.ceil(Math.random() * SHORT_DELAY) + SHORT_DELAY;
	},

	mediumDelay () {
		return Math.ceil(Math.random() * MEDIUM_DELAY) + MEDIUM_DELAY;
	},

	longDelay () {
		return Math.ceil(Math.random() * LONG_DELAY) + LONG_DELAY;
	},

	ONE_MINUTE
};

module.exports = delayTimes;
