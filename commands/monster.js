/* eslint-disable max-len, security/detect-unsafe-regex */

const cleanArgs = (args = {}) => {
	if (args.monsterName !== 'monster' && typeof args.monsterName === 'string') {
		args.monsterName = args.monsterName.trim().replace(/^monster\s+/i, '');
	} else {
		delete args.monsterName;
	}

	return args;
};

const CALL_MONSTER_OUT_OF_THE_RING_REGEX = /(?:remove|call|fetch|bring|summon) (?:a )?(.+?)? (?:from|out of) (?:the )?(?:ring|battle)$/i;
function callMonsterOutOfTheRingAction ({ character, results }) {
	return Promise.resolve()
		.then(() => {
			const args = {
				monsterName: results[1]
			};

			return character.callMonsterOutOfTheRing(cleanArgs(args));
		});
}

const DISMISS_REGEX = /dismiss (?:a )?(.+?)$/i;
function dismissMonsterAction ({ character, results }) {
	return Promise.resolve()
		.then(() => {
			const args = {
				monsterName: results[1]
			};

			return character.dismissMonster(cleanArgs(args));
		});
}

const EDIT_REGEX = /edit monster (.+?)$/i;
function editMonsterAction ({ character, isAdmin, results }) {
	if (!isAdmin) {
		return Promise.reject(new Error('You do not have sufficient privileges to edit monsters.'));
	}

	return Promise.resolve()
		.then(() => {
			const args = {
				monsterName: results[1]
			};

			return character.editMonster(cleanArgs(args));
		});
}

const EQUIP_REGEX = /equip (?:a )?(.+?)(?: with (.+?))?$/i;
function equipMonsterAction ({ character, results }) {
	return Promise.resolve()
		.then(() => {
			const args = {
				cardSelection: results[2],
				monsterName: results[1]
			};

			return character.equipMonster(cleanArgs(args));
		});
}

const GIVE_ITEMS_TO_MONSTER_REGEX = /give (?:(?:an )?items?|(.+?)?) to (?:a )?(.+?)$/i;
function giveItemsToMonsterAction ({ character, results }) {
	return Promise.resolve()
		.then(() => {
			const args = {
				itemSelection: results[1],
				monsterName: results[2]
			};

			return character.giveItemsToMonster(cleanArgs(args));
		});
}

const REVIVE_REGEX = /revive (?:a )?(.+?)$/i;
function reviveMonsterAction ({ character, results }) {
	return Promise.resolve()
		.then(() => {
			const args = {
				monsterName: results[1]
			};

			return character.reviveMonster(cleanArgs(args));
		});
}

const SEND_MONSTER_TO_THE_RING_REGEX = /send (?:a )?(.+?)? (?:to|into) (?:the )?(?:ring|battle)$/i;
function sendMonsterToTheRingAction ({ character, results }) {
	return Promise.resolve()
		.then(() => {
			const args = {
				monsterName: results[1]
			};

			return character.sendMonsterToTheRing(cleanArgs(args));
		});
}

const SPAWN_REGEX = /spawn (?:a )?monster$/i;
function spawnAction ({ character }) {
	return character.spawnMonster();
}

const SPAWN_BOSS_REGEX = /spawn (?:a )?boss$/i;
function spawnBossAction ({ game, isAdmin }) {
	if (!isAdmin) {
		return Promise.reject(new Error('Only admins can spawn bosses.'));
	}

	return Promise.resolve(game.getRing())
		.then(ring => ring.spawnBoss());
}

const TAKE_ITEMS_FROM_MONSTER_REGEX = /take (?:(?:an )?items?|(.+?)?) from (?:a )?(.+?)$/i;
function takeItemsFromMonsterAction ({ character, results }) {
	return Promise.resolve()
		.then(() => {
			const args = {
				itemSelection: results[1],
				monsterName: results[2]
			};

			return character.takeItemsFromMonster(cleanArgs(args));
		});
}

const USE_ITEMS_ON_MONSTER_REGEX = /use (?:(?:an )?items?|(.+?)?) on (?:a )?(.+?)$/i;
function useItemsOnMonsterAction ({ character, results }) {
	return Promise.resolve()
		.then(() => {
			const args = {
				itemSelection: results[1],
				monsterName: results[2]
			};

			return character.useItemsOnMonster(cleanArgs(args));
		});
}

module.exports = function (registerHandler) {
	registerHandler(CALL_MONSTER_OUT_OF_THE_RING_REGEX, callMonsterOutOfTheRingAction);
	registerHandler(DISMISS_REGEX, dismissMonsterAction);
	registerHandler(EDIT_REGEX, editMonsterAction);
	registerHandler(EQUIP_REGEX, equipMonsterAction);
	registerHandler(GIVE_ITEMS_TO_MONSTER_REGEX, giveItemsToMonsterAction);
	registerHandler(REVIVE_REGEX, reviveMonsterAction);
	registerHandler(SEND_MONSTER_TO_THE_RING_REGEX, sendMonsterToTheRingAction);
	registerHandler(SPAWN_REGEX, spawnAction);
	registerHandler(SPAWN_BOSS_REGEX, spawnBossAction);
	registerHandler(TAKE_ITEMS_FROM_MONSTER_REGEX, takeItemsFromMonsterAction);
	registerHandler(USE_ITEMS_ON_MONSTER_REGEX, useItemsOnMonsterAction);
};
