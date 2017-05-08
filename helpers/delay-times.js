const delayTimes = {
	shortDelay () {
		return Math.ceil(Math.random() * 500) + 300;
	},

	mediumDelay () {
		return Math.ceil(Math.random() * 1000) + 1000;
	},

	longDelay () {
		return Math.ceil(Math.random() * 2500) + 2500;
	}
};

module.exports = delayTimes;
