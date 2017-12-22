/* eslint-disable max-len */

const BaseClass = require('../baseClass');

class Exploration extends BaseClass {
	constructor (channelManager, { ...options } = {}, log) {
		super(options);

		this.log = log;
		this.channelManager = channelManager;
	}
}

Exploration.eventPrefix = 'exploration';

module.exports = Exploration;
