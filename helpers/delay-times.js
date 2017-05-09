const SHORT_DELAY = 300;
const MEDIUM_DELAY = 900;
const LONG_DELAY = 2100;

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
