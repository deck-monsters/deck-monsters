import getArray from '../helpers/get-array.js';
import { announceAndThrow } from '../helpers/announce-and-throw.js';
import { formatRelative } from '../helpers/time.js';
import {
	BOSS_SUMMON_LIMIT,
	addPendingSummon,
	recordSummon,
	summonAllowance,
} from '../helpers/boss-summons.js';
import { getRingEvent, RING_EVENTS } from '../ring/ring-events.js';
import type { registerHandler } from './index.js';

const cleanArgs = (args: Record<string, any> = {}): Record<string, any> => {
	if (args.monsterName !== 'monster' && typeof args.monsterName === 'string') {
		args.monsterName = args.monsterName.trim().replace(/^monster\s+/i, '');
	} else {
		delete args.monsterName;
	}

	if (typeof args.fromMonsterName === 'string') {
		args.fromMonsterName = args.fromMonsterName.trim().replace(/^monster\s+/i, '');
	}

	if (typeof args.toMonsterName === 'string') {
		args.toMonsterName = args.toMonsterName.trim().replace(/^monster\s+/i, '');
	}

	if (args.cardSelection) {
		args.cardSelection = getArray(args.cardSelection);
	}

	if (args.cardName && typeof args.cardName === 'string') {
		args.cardName = args.cardName.trim();
	}

	if (args.count !== undefined) {
		const parsedCount = Number(args.count);
		args.count = Number.isFinite(parsedCount) ? parsedCount : undefined;
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
	user,
}: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const { monsterName } = cleanArgs({ monsterName: results[1] });

		return character
			.callMonsterOutOfTheRing({ monsterName, ring: game.getRing(), channel, channelName, userId: user?.id })
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

const EQUIP_REGEX = /^equip (?:a )?(.+?)(?: with (.+?))?$/i;
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

const UNEQUIP_CARD_REGEX = /unequip (?:(\d+) )?(.+?) from (?:a )?(.+?)$/i;
function unequipCardAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const { cardName, count, monsterName } = cleanArgs({
			count: results[1],
			cardName: results[2],
			monsterName: results[3],
		});

		return character
			.unequipCard({ channel, cardName, count, monsterName })
			.catch((err: unknown) => game.log(err));
	});
}

const UNEQUIP_ALL_REGEX = /(?:unequip all from|clear deck) (?:a )?(.+?)$/i;
function unequipAllAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const { monsterName } = cleanArgs({ monsterName: results[1] });

		return character
			.unequipAll({ channel, monsterName })
			.catch((err: unknown) => game.log(err));
	});
}

const MOVE_CARD_REGEX = /move (?:(\d+) )?(.+?) from (?:a )?(.+?) to (?:a )?(.+?)$/i;
function moveCardAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const { cardName, count, fromMonsterName, toMonsterName } = cleanArgs({
			count: results[1],
			cardName: results[2],
			fromMonsterName: results[3],
			toMonsterName: results[4],
		});

		return character
			.moveCard({ channel, cardName, count, fromMonsterName, toMonsterName })
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
	user,
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
				userId: user?.id,
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
function spawnBossAction({ channel, game, isAdmin }: any): Promise<unknown> {
	if (!isAdmin) {
		// announceAndThrow rather than a bare reject: the router's `.catch` swallows the
		// rejection, so a bare reject leaves the player staring at a console that ignored them.
		return announceAndThrow(channel, 'Only admins can spawn bosses.');
	}

	return Promise.resolve(game.getRing()).then((ring: any) => ring.spawnBoss());
}

const BOSS_REFUSAL_MESSAGES: Record<string, string> = {
	in_encounter: 'A fight is already underway — wait for it to finish before summoning a boss.',
	boss_cap: 'There are already as many bosses in the ring as it can hold.',
	ring_full: 'The ring is full! Wait until the current battle is over and try again.',
};

const SUMMON_BOSS_REGEX = /summon (?:a )?boss$/i;
function summonBossAction({ channel, character, game, isDM, user }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve().then(() => {
		const ring = game.getRing();
		const userId = user?.id;

		if (!userId) {
			return announceAndThrow(channel, 'I could not work out who you are.');
		}

		const hasMonsterInRing = ring.contestants.some(
			(contestant: any) => contestant.character === character && !contestant.isBoss
		);
		if (!hasMonsterInRing) {
			return announceAndThrow(
				channel,
				'You need a monster in the ring before you can summon a boss. Try `send [monster] to the ring` first.'
			);
		}

		const capacity = ring.canAcceptBoss();
		if (!capacity.ok) {
			return announceAndThrow(
				channel,
				BOSS_REFUSAL_MESSAGES[capacity.reason] ?? 'The ring cannot take another boss right now.'
			);
		}

		// Check and record in one synchronous run, with no await in between. On the web path
		// this also sits inside the per-user engine lane, but the Discord connector calls
		// game.handleCommand() directly with no lane at all — so atomicity has to come from
		// here. See docs/engine-concurrency-and-timing.md.
		const now = Date.now();
		const allowance = summonAllowance(game.bossSummons, userId, now);

		if (!allowance.allowed) {
			return announceAndThrow(
				channel,
				`You have used all ${BOSS_SUMMON_LIMIT} of your boss summons for today. Your next summon unlocks ${formatRelative(allowance.nextAvailableAt ?? now, now)}.`
			);
		}

		const contestant = ring.spawnBoss();
		if (!contestant) {
			// Belt and braces — nothing above yields, so this cannot lose a race. Bail before
			// spending the charge rather than burning it on a boss that never arrived.
			return announceAndThrow(
				channel,
				'The ring cannot take another boss right now. Your summon has not been used.'
			);
		}

		game.bossSummons = recordSummon(game.bossSummons, userId, now);
		// Mark as pending so a process restart before the fight starts can refund this
		// charge — the boss is ephemeral and would vanish, but the spent charge would
		// not. Cleared when the encounter begins (Game.initializeEvents / ring.fight).
		// See docs/boss-encounters.md §3 (Finding 6 — restart-gap fix).
		game.bossSummonsPending = addPendingSummon(game.bossSummonsPending, userId, now);

		const remaining = allowance.remaining - 1;
		const { monster } = contestant;

		ring.emit('bossSummoned', { userId, contestant });

		ring.eventBus.publish({
			type: 'announce',
			scope: 'public',
			text: `${character.givenName ?? 'A beastmaster'} has summoned a boss into the ring!`,
			payload: { summonedBy: userId },
		});

		return channel({
			announce: `⚔️ You summoned ${monster.identity} — a ${monster.displayLevel} ${monster.creatureType}!\n\nYou have ${remaining} boss ${remaining === 1 ? 'summon' : 'summons'} left today.`,
		});
	});
}

const TRIGGER_RING_EVENT_REGEX = /trigger (?:ring )?event (.+)$/i;
function triggerRingEventAction({ channel, game, isAdmin, results }: any): Promise<unknown> {
	if (!isAdmin) {
		return announceAndThrow(channel, 'Only admins can trigger ring events.');
	}

	return Promise.resolve().then(() => {
		const ringEvent = getRingEvent(String(results[1] ?? ''));

		if (!ringEvent) {
			return announceAndThrow(
				channel,
				`Unknown ring event. Known events: ${RING_EVENTS.map(event => event.id).join(', ')}.`
			);
		}

		const ring = game.getRing();

		// Refuse during an encounter — the event would never be applied (apply() fires in
		// startEncounter() against the final roster, which already happened) and we would
		// record an event that has no effect, confusing the fight log. See docs/boss-encounters.md §4.
		if (ring.inEncounter) {
			return announceAndThrow(
				channel,
				'Cannot force a ring event while an encounter is in progress — the event would have no effect.'
			);
		}

		// Use the same centralized activation path as the natural roll so both paths are
		// identical: announcement emitted, extra bosses spawned (Gauntlet), metrics fired.
		ring.activateRingEvent(ringEvent);
		// Re-arm the fight timer so the newly-spawned bosses (if any) are included in the
		// countdown roster. rollRingEvent() is guarded by `if (this.ringEvent)` so it will
		// not re-roll the event we just set.
		ring.startFightTimer();

		return channel({ announce: `Ring event forced: ${ringEvent.name}.` });
	});
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
	registerHandlerFn(UNEQUIP_CARD_REGEX, unequipCardAction);
	registerHandlerFn(UNEQUIP_ALL_REGEX, unequipAllAction);
	registerHandlerFn(MOVE_CARD_REGEX, moveCardAction);
	registerHandlerFn(GIVE_ITEMS_TO_MONSTER_REGEX, giveItemsToMonsterAction);
	registerHandlerFn(REVIVE_REGEX, reviveMonsterAction);
	registerHandlerFn(SEND_MONSTER_EXPLORING_REGEX, sendMonsterExploringAction);
	registerHandlerFn(SEND_MONSTER_TO_THE_RING_REGEX, sendMonsterToTheRingAction);
	registerHandlerFn(SPAWN_REGEX, spawnAction);
	registerHandlerFn(SPAWN_BOSS_REGEX, spawnBossAction);
	registerHandlerFn(SUMMON_BOSS_REGEX, summonBossAction);
	registerHandlerFn(TRIGGER_RING_EVENT_REGEX, triggerRingEventAction);
	registerHandlerFn(TAKE_ITEMS_FROM_MONSTER_REGEX, takeItemsFromMonsterAction);
	registerHandlerFn(USE_ITEMS_ON_MONSTER_REGEX, useItemsOnMonsterAction);
}
