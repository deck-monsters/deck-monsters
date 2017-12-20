const BaseClass = require('../baseClass');

class BaseAnnounce extends BaseClass {
	constructor (options) {
		super(options);
	}
}

BaseAnnounce.eventPrefix = 'announce';

module.exports = BaseAnnounce;
