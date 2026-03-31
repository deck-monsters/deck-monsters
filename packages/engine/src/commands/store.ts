import type { registerHandler } from './index.js';

const BUY_REGEX = /(?:visit|go to|browse|buy from) the (?:store|shop)$/i;
function buyItemsAction({ channel, character, game, isDM }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve()
		.then(() => character.buyItems(channel))
		.catch((err: unknown) => game.log(err));
}

const SELL_REGEX = /(?:sell something to|sell to) the (?:store|shop)$/i;
function sellItemsAction({ channel, character, game, isDM }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve()
		.then(() => character.sellItems(channel))
		.catch((err: unknown) => game.log(err));
}

export default function storeHandlers(registerHandlerFn: typeof registerHandler): void {
	registerHandlerFn(BUY_REGEX, buyItemsAction);
	registerHandlerFn(SELL_REGEX, sellItemsAction);
}
