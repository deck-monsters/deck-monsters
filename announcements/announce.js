const { getFlavor } = require('../helpers/flavor');
const { globalSemaphore } = require('../helpers/semaphore');

const BaseClass = require('../baseClass');

class BaseAnnounce extends BaseClass {
	constructor ({channel}) {
		super({ channel });
	}

	get channel () {
		return this.options.channel;
	}

	getFlaver (flavor, flavors) {
		return getFlavor(flavor, flavors);
	}
}

BaseAnnounce.eventPrefix = 'announce';

module.exports = BaseAnnounce;
