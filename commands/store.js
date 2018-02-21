/* eslint-disable max-len, security/detect-unsafe-regex */

const BUY_REGEX = /(?:visit|go to|browse|buy from) the (?:store|shop)$/i;
function buyItemsAction ({ character }) {
	return Promise.resolve()
		.then(() => character.buyItems());
}

const SELL_REGEX = /(?:sell something to|sell to) the (?:store|shop)$/i;
function sellItemsAction ({ character }) {
	return Promise.resolve()
		.then(() => character.sellItems());
}

module.exports = function (registerHandler) {
	registerHandler(BUY_REGEX, buyItemsAction);
	registerHandler(SELL_REGEX, sellItemsAction);
};
