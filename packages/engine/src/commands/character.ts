import getArray from '../helpers/get-array.js';
import type { registerHandler } from './index.js';

const cleanArgs = (args: Record<string, any> = {}): Record<string, any> => {
	if (args.characterName) {
		args.characterName = args.characterName.trim();
	}

	if (args.itemSelection) {
		args.itemSelection = getArray(args.itemSelection, true);
	}

	return args;
};

const EDIT_REGEX = /edit character (.+?)$/i;
function editCharacterAction({ channel, game, isAdmin, results }: any): Promise<unknown> {
	if (!isAdmin) {
		return Promise.reject(
			new Error('You do not have sufficient privileges to edit characters')
		);
	}

	return Promise.resolve().then(() => {
		const { characterName } = cleanArgs({ characterName: results[1] });

		return game
			.editCharacter(channel, characterName)
			.catch((err: unknown) => game.log(err));
	});
}

const EDIT_SELF_REGEX = /edit (?:my )?character$/i;
function editSelfCharacterAction({ channel, character, game }: any): Promise<unknown> {
	return Promise.resolve().then(() =>
		game
			.editSelfCharacter(channel, character)
			.catch((err: unknown) => game.log(err))
	);
}

const USE_ITEMS_REGEX = /use (?:(?:an )?items?|(.+?)?)$/i;
function useItemsAction({ channel, channelName, character, game, results }: any): Promise<unknown> {
	return Promise.resolve().then(() => {
		const { itemSelection } = cleanArgs({ itemSelection: results[1] });

		return character
			.useItems({ channel, channelName, isMonsterItem: false, itemSelection })
			.catch((err: unknown) => game.log(err));
	});
}

export default function characterHandlers(
	registerHandlerFn: typeof registerHandler
): void {
	registerHandlerFn(EDIT_SELF_REGEX, editSelfCharacterAction);
	registerHandlerFn(EDIT_REGEX, editCharacterAction);
	registerHandlerFn(USE_ITEMS_REGEX, useItemsAction);
}
