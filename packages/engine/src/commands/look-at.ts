import type { registerHandler } from './index.js';

// The trailing group is `( .+|(?<= )\S.*)?`. It used to be `( .+)?`, which broke the bare
// `look at <name>` form (`look at Fluffy`, `look at Hit`): `(?:at )?` had already eaten the
// only space, so nothing matched and the catalogued commands were unreachable. The lookbehind
// lets the name start right after a space the pattern already consumed, while a type word
// such as `monster` still needs its own space — `look at monstrous` falls through to the
// default `game.lookAt` instead of being read as type `monster`.
const LOOK_AT_REGEX =
	/^look (?:at )?(?:the )?(monster(?:s)? manual|player(?:s)? handbook|(?:dungeon master(?:s)|dm)? guide|monsters in|monsters|monster|character|cards in|card inventory|all cards|inventory|cards|card|deck|item|items|ring|dmg)?( .+|(?<= )\S.*)?$/i;

function lookAtAction({ channel, character, game, results, user }: any): Promise<unknown> {
	return Promise.resolve()
		.then(() => {
			const type = (results[1] || '').trim().toLowerCase();
			let thing = (results[2] || '').trim().toLowerCase();

			switch (type) {
				case 'deck':
				case 'cards':
					return character.lookAtCards(channel, thing);
				case 'card inventory':
				case 'all cards':
					return character.lookAtCardInventory(channel);
				case 'inventory':
					return character.lookAtInventory(channel);
				case 'ring': {
					const summary = thing === 'summary';
					return game.lookAtRing(user.id, undefined, true, summary);
				}
				case 'monsters in': {
					// `monsters in` is listed before `monsters` in the pattern, so it also swallows
					// the catalogued `look at monsters in detail`, which then looked for a ring
					// called "detail" and announced "The ring is empty." Route it to the detail view.
					if (thing === 'detail') {
						return character.lookAtMonsters(channel, true);
					}
					thing = thing.replace(/the /i, '');
					const ringName = thing === 'ring' ? undefined : thing;
					return game.lookAtRing(user.id, ringName, false);
				}
				case 'cards in': {
					thing = thing.replace(/the /i, '');
					const ringName = thing === 'ring' ? undefined : thing;
					return game.lookAtRingCards(user.id, ringName);
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
		.catch((err: unknown) => game.log(err));
}

export default function lookAtHandlers(registerHandlerFn: typeof registerHandler): void {
	registerHandlerFn(LOOK_AT_REGEX, lookAtAction);
}
