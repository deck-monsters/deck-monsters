/* eslint-disable max-len, security/detect-unsafe-regex */

const BUY_REGEX = /(?:visit|go to|browse|buy from) the (?:store|shop)$/i;
function buyItemsAction ({ channel, character, game, isDM }) {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve()
		.then(() => character.buyItems(channel))
		.catch(err => game.log(err));
}

const SELL_REGEX = /(?:sell something to|sell to) the (?:store|shop)$/i;
function sellItemsAction ({ channel, character, game, isDM }) {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve()
		.then(() => character.sellItems(channel))
		.catch(err => game.log(err));
}

module.exports = function (registerHandler) {
	registerHandler(BUY_REGEX, buyItemsAction);
	registerHandler(SELL_REGEX, sellItemsAction);
};
