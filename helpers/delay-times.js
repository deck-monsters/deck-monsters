const SHORT_DELAY = 1300;
const MEDIUM_DELAY = 1900;
const LONG_DELAY = 3100;

const delayTimes = {
	shortDelay () {
		return Math.ceil(Math.random() * SHORT_DELAY) + SHORT_DELAY;
	},

	mediumDelay () {
		return Math.ceil(Math.random() * MEDIUM_DELAY) + MEDIUM_DELAY;
	},

	longDelay () {
		return Math.ceil(Math.random() * LONG_DELAY) + LONG_DELAY;
	}
};

module.exports = delayTimes;
