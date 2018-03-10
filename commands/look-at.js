/* eslint-disable max-len, security/detect-unsafe-regex */

const LOOK_AT_REGEX = /look (?:at )?(?:the )?(monster(?:s)? manual|player(?:s)? handbook|(?:dungeon master(?:s)|dm)? guide|monsters in|monsters|monster|character|cards in|cards|card|deck|item|items|ring|dmg)?( .+)?$/i;
function lookAtAction ({ channel, character, game, results }) {
	return Promise.resolve()
		.then(() => {
			const type = (results[1] || '').trim().toLowerCase();
			let thing = (results[2] || '').trim().toLowerCase();

			switch (type) {
				case 'deck':
				case 'cards':
					return character.lookAtCards(channel, thing);
				case 'ring': {
					const summary = thing === 'summary';
					return game.lookAtRing(channel, undefined, true, summary);
				}
				case 'monsters in': {
					thing = thing.replace(/the /i, '');
					const ringName = thing === 'ring' ? undefined : thing;
					return game.lookAtRing(channel, ringName, false);
				}
				case 'cards in': {
					thing = thing.replace(/the /i, '');
					const ringName = thing === 'ring' ? undefined : thing;
					return game.lookAtRingCards(channel, ringName);
				}
				case 'monsters': {
					const inDetail = thing === 'in detail';
					return character.lookAtMonsters(channel, inDetail);
				}
				case 'monster': {
					if (thing === 'rankings') {
						return game.lookAtMonsterRankings(channel);
					}

					return game.lookAtMonster(channel, thing, character);
				}
				case 'character': {
					if (thing === 'rankings') {
						return game.lookAtCharacterRankings(channel);
					}

					return game.lookAtCharacter(channel, thing, character);
				}
				case 'card':
					return game.lookAtCard(channel, thing);
				case 'item':
					return game.lookAtItem(channel, thing);
				case 'items':
					return character.lookAtItems(channel);
				default:
					return game.lookAt(channel, type + thing);
			}
		})
		.catch(err => game.log(err));
}

module.exports = function (registerHandler) {
	registerHandler(LOOK_AT_REGEX, lookAtAction);
};
