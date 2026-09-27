import { announceAndThrow } from '../helpers/announce-and-throw.js';
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

/*
 * Teams used to be joinable (a Sorting Hat) but never leavable: the hat only offered the
 * other houses. The owner asked for switching and clearing to be easy and obvious
 * (docs/archive/roadmap/31-pass-b-rings-and-bosses.md), so leaving is a free command.
 */
const LEAVE_TEAM_REGEX = /(?:leave|clear|quit) (?:my |our )?teams?$/i;
function leaveTeamAction({ channel, character }: any): Promise<unknown> {
	return Promise.resolve().then(() => {
		const monsters: any[] = character.monsters ?? [];
		if (monsters.some(monster => monster.inEncounter)) {
			return announceAndThrow(channel, 'One of your monsters is fighting right now. Leave your team once the fight is over.');
		}

		const onTeam = [character, ...monsters].filter(creature => creature.team);
		if (onTeam.length === 0) {
			return channel({ announce: 'You and your monsters are not on a team. A Sorting Hat, always in the shop, puts you on one.' });
		}

		const teams = [...new Set(onTeam.map(creature => creature.team))];
		for (const creature of onTeam) creature.team = undefined;
		return channel({
			announce: `You and your monsters have left ${teams.join(' and ')}. In a fight with bosses you will still stand with the other challengers; after that it is every monster for itself.`,
		});
	});
}

export default function characterHandlers(
	registerHandlerFn: typeof registerHandler
): void {
	registerHandlerFn(EDIT_SELF_REGEX, editSelfCharacterAction);
	registerHandlerFn(EDIT_REGEX, editCharacterAction);
	registerHandlerFn(LEAVE_TEAM_REGEX, leaveTeamAction);
	registerHandlerFn(USE_ITEMS_REGEX, useItemsAction);
}
