class BaseCard {
	constructor (options) {
		this.options = options;
	}

	get options () {
		return this.optionsStore || {};
	}

	set options (options) {
		this.optionsStore = Object.assign({}, this.options, options);
	}
}

module.exports = BaseCard;
