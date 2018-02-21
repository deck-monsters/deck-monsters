/* eslint-disable max-len, security/detect-unsafe-regex */

const EDIT_REGEX = /edit character (.+?)$/i;
function editCharacterAction ({ character, isAdmin, results }) {
	if (!isAdmin) {
		return Promise.reject(new Error('You do not have sufficient privileges to edit characters'));
	}

	return Promise.resolve()
		.then(() => {
			const args = {
				characterName: results[1].trim()
			};

			return character.editCharacter(args);
		});
}

const USE_ITEMS_REGEX = /use (?:(?:an )?items?|(.+?)?)$/i;
function useItemsAction ({ character, results }) {
	return Promise.resolve()
		.then(() => {
			const args = {
				itemSelection: results[1]
			};

			return character.useItems(args);
		});
}

module.exports = function (registerHandler) {
	registerHandler(EDIT_REGEX, editCharacterAction);
	registerHandler(USE_ITEMS_REGEX, useItemsAction);
};
