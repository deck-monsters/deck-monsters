/* eslint-disable max-len */

const BaseClass = require('../baseClass');

class Exploration extends BaseClass {
	constructor ({ ...options } = {}, log) {
		super(options);

		this.log = log;
	}
}

Exploration.eventPrefix = 'exploration';

module.exports = Exploration;
