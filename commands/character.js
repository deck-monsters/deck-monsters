/* eslint-disable max-len, security/detect-unsafe-regex */
const getArray = require('../helpers/get-array');

const cleanArgs = (args = {}) => {
	if (args.characterName) {
		args.characterName = args.characterName.trim();
	}

	if (args.itemSelection) {
		args.itemSelection = getArray(args.itemSelection, true);
	}

	return args;
};

const EDIT_REGEX = /edit character (.+?)$/i;
function editCharacterAction ({ channel, game, isAdmin, results }) {
	if (!isAdmin) {
		return Promise.reject(new Error('You do not have sufficient privileges to edit characters'));
	}

	return Promise.resolve()
		.then(() => {
			const {
				characterName
			} = cleanArgs({
				characterName: results[1]
			});

			return game.editCharacter(channel, characterName)
				.catch(err => game.log(err));
		});
}

const USE_ITEMS_REGEX = /use (?:(?:an )?items?|(.+?)?)$/i;
function useItemsAction ({ channel, channelName, character, game, results }) {
	return Promise.resolve()
		.then(() => {
			const {
				itemSelection
			} = cleanArgs({
				itemSelection: results[1]
			});

			return character.useItems({
				channel, channelName, isMonsterItem: false, itemSelection
			})
				.catch(err => game.log(err));
		});
}

module.exports = function (registerHandler) {
	registerHandler(EDIT_REGEX, editCharacterAction);
	registerHandler(USE_ITEMS_REGEX, useItemsAction);
};
