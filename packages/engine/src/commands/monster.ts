import getArray from '../helpers/get-array.js';
import type { registerHandler } from './index.js';

const cleanArgs = (args: Record<string, any> = {}): Record<string, any> => {
	if (args.monsterName !== 'monster' && typeof args.monsterName === 'string') {
		args.monsterName = args.monsterName.trim().replace(/^monster\s+/i, '');
	} else {
		delete args.monsterName;
	}

	if (args.cardSelection) {
		args.cardSelection = getArray(args.cardSelection);
	}

	if (args.itemSelection) {
		args.itemSelection = getArray(args.itemSelection, true);
	}

	return args;
};

const CALL_MONSTER_OUT_OF_THE_RING_REGEX =
	/(?:remove|call|fetch|bring|summon) (?:a )?(.+?)? (?:from|out of) (?:the )?(?:ring|battle)$/i;
function callMonsterOutOfTheRingAction({
	channel,
	channelName,
	character,
	game,
	isDM,
	results,
}: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const { monsterName } = cleanArgs({ monsterName: results[1] });

		return character
			.callMonsterOutOfTheRing({ monsterName, ring: game.getRing(), channel, channelName })
			.catch((err: unknown) => game.log(err));
	});
}

const DISMISS_REGEX = /dismiss (?:a )?(.+?)$/i;
function dismissMonsterAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const { monsterName } = cleanArgs({ monsterName: results[1] });

		return character
			.dismissMonster({ monsterName, channel })
			.catch((err: unknown) => game.log(err));
	});
}

const EDIT_REGEX = /edit monster (.+?)$/i;
function editMonsterAction({ channel, game, isAdmin, results }: any): Promise<unknown> {
	if (!isAdmin) {
		return Promise.reject(new Error('You do not have sufficient privileges to edit monsters'));
	}

	return Promise.resolve().then(() => {
		const { monsterName } = cleanArgs({ monsterName: results[1] });

		return game.editMonster(channel, monsterName);
	});
}

const EQUIP_REGEX = /equip (?:a )?(.+?)(?: with (.+?))?$/i;
function equipMonsterAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const { cardSelection, monsterName } = cleanArgs({
			cardSelection: results[2],
			monsterName: results[1],
		});

		return character
			.equipMonster({ channel, cardSelection, monsterName })
			.catch((err: unknown) => game.log(err));
	});
}

const GIVE_ITEMS_TO_MONSTER_REGEX = /give (?:(?:an )?items?|(.+?)?) to (?:a )?(.+?)$/i;
function giveItemsToMonsterAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const { itemSelection, monsterName } = cleanArgs({
			itemSelection: results[1],
			monsterName: results[2],
		});

		return character
			.giveItemsToMonster({ channel, itemSelection, monsterName })
			.catch((err: unknown) => game.log(err));
	});
}

const REVIVE_REGEX = /revive (?:a )?(.+?)$/i;
function reviveMonsterAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const { monsterName } = cleanArgs({ monsterName: results[1] });

		return character
			.reviveMonster({ monsterName, channel })
			.catch((err: unknown) => game.log(err));
	});
}

const SEND_MONSTER_EXPLORING_REGEX = /send (?:a )?(.+?)? exploring$/i;
function sendMonsterExploringAction({
	channel,
	channelName,
	character,
	game,
	isDM,
	results,
}: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const { monsterName } = cleanArgs({ monsterName: results[1] });

		return character
			.sendMonsterExploring({
				monsterName,
				exploration: game.getExploration(),
				channel,
				channelName,
			})
			.catch((err: unknown) => game.log(err));
	});
}

const SEND_MONSTER_TO_THE_RING_REGEX =
	/send (?:a )?(.+?)? (?:to|into) (?:the )?(?:ring|battle)$/i;
function sendMonsterToTheRingAction({
	channel,
	channelName,
	character,
	game,
	isDM,
	results,
}: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const { monsterName } = cleanArgs({ monsterName: results[1] });

		return character
			.sendMonsterToTheRing({
				monsterName,
				ring: game.getRing(),
				channel,
				channelName,
			})
			.catch((err: unknown) => game.log(err));
	});
}

const SPAWN_REGEX = /spawn (?:a )?monster$/i;
function spawnAction({ channel, character, game, isDM, ...options }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return character
		.spawnMonster(channel, { ...options, game })
		.catch((err: unknown) => game.log(err));
}

const SPAWN_BOSS_REGEX = /spawn (?:a )?boss$/i;
function spawnBossAction({ game, isAdmin }: any): Promise<unknown> {
	if (!isAdmin) {
		return Promise.reject(new Error('Only admins can spawn bosses'));
	}

	return Promise.resolve(game.getRing()).then((ring: any) => ring.spawnBoss());
}

const TAKE_ITEMS_FROM_MONSTER_REGEX = /take (?:(?:an )?items?|(.+?)?) from (?:a )?(.+?)$/i;
function takeItemsFromMonsterAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const { itemSelection, monsterName } = cleanArgs({
			itemSelection: results[1],
			monsterName: results[2],
		});

		return character
			.takeItemsFromMonster({ channel, itemSelection, monsterName })
			.catch((err: unknown) => game.log(err));
	});
}

const USE_ITEMS_ON_MONSTER_REGEX = /use (?:(?:an )?items?|(.+?)?) on (?:a )?(.+?)$/i;
function useItemsOnMonsterAction({ channel, channelName, character, game, results }: any): Promise<unknown> {
	return Promise.resolve().then(() => {
		const { itemSelection, monsterName } = cleanArgs({
			itemSelection: results[1],
			monsterName: results[2],
		});

		return character
			.useItems({
				channel,
				channelName,
				isMonsterItem: true,
				itemSelection,
				monsterName,
			})
			.catch((err: unknown) => game.log(err));
	});
}

export default function monsterHandlers(
	registerHandlerFn: typeof registerHandler
): void {
	registerHandlerFn(CALL_MONSTER_OUT_OF_THE_RING_REGEX, callMonsterOutOfTheRingAction);
	registerHandlerFn(DISMISS_REGEX, dismissMonsterAction);
	registerHandlerFn(EDIT_REGEX, editMonsterAction);
	registerHandlerFn(EQUIP_REGEX, equipMonsterAction);
	registerHandlerFn(GIVE_ITEMS_TO_MONSTER_REGEX, giveItemsToMonsterAction);
	registerHandlerFn(REVIVE_REGEX, reviveMonsterAction);
	registerHandlerFn(SEND_MONSTER_EXPLORING_REGEX, sendMonsterExploringAction);
	registerHandlerFn(SEND_MONSTER_TO_THE_RING_REGEX, sendMonsterToTheRingAction);
	registerHandlerFn(SPAWN_REGEX, spawnAction);
	registerHandlerFn(SPAWN_BOSS_REGEX, spawnBossAction);
	registerHandlerFn(TAKE_ITEMS_FROM_MONSTER_REGEX, takeItemsFromMonsterAction);
	registerHandlerFn(USE_ITEMS_ON_MONSTER_REGEX, useItemsOnMonsterAction);
}
