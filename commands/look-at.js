/* eslint-disable max-len, security/detect-unsafe-regex */

const LOOK_AT_REGEX = /look (?:at )?(?:the )?(monster(?:s)? manual|player(?:s)? handbook|(?:dungeon master(?:s)|dm)? guide|monsters in|monsters|monster|character|cards in|cards|card|deck|item|items|ring|dmg)?( .+)?$/i;
function lookAtAction ({ character, results }) {
	return Promise.resolve()
		.then(() => {
			const type = (results[1] || '').trim().toLowerCase();
			let thing = (results[2] || '').trim().toLowerCase();

			switch (type) {
				case 'deck':
				case 'cards':
					return character.lookAtCards({ deckName: thing });
				case 'ring':
					return character.lookAtRing({ ringName: thing });
				case 'monsters in': {
					thing = thing.replace(/the /i, '');
					const ringName = thing === 'ring' ? undefined : thing;
					return character.lookAtRing({ ringName, showCharacters: false });
				}
				case 'cards in': {
					thing = thing.replace(/the /i, '');
					const ringName = thing === 'ring' ? undefined : thing;
					return character.lookAtRingCards({ ringName });
				}
				case 'monsters':
					return character.lookAtMonsters({ inDetail: thing === 'in detail' });
				case 'monster':
					return character.lookAtMonster({ monsterName: thing });
				case 'character':
					return character.lookAtCharacter({ characterName: thing });
				case 'card':
					return character.lookAtCard({ cardName: thing });
				case 'item':
					return character.lookAtItem({ itemName: thing });
				case 'items':
					return character.lookAtItems();
				default:
					return character.lookAt(type + thing);
			}
		});
}

module.exports = function (registerHandler) {
	registerHandler(LOOK_AT_REGEX, lookAtAction);
};
