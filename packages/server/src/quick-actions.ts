/**
 * Builds the contextual command chips shown under the web console after a
 * command completes (`quick_actions` events).
 *
 * Every emitted `command` string must be one the engine's parser actually
 * accepts — these are dispatched verbatim when the user clicks a chip. Keep
 * them aligned with `COMMAND_CATALOG` in the engine.
 *
 * The game object is intentionally typed loosely: engine entities are `any` at
 * the package boundary and may be partially hydrated, so every field access
 * here is defensive. Returning fewer suggestions is always preferable to
 * throwing inside the command pipeline.
 */

import { summonAllowance, type BossSummonLedger } from '@deck-monsters/engine';

export interface QuickAction {
	label: string;
	command: string;
}

const MAX_QUICK_ACTIONS = 4;
const DEFAULT_CARD_SLOTS = 9;

type LooseRecord = Record<string, unknown>;

type QuickActionsGame = {
	characters?: Record<string, unknown>;
	bossSummons?: BossSummonLedger;
	ring?: {
		contestants?: Array<{ userId?: string; monster?: unknown; isBoss?: boolean }>;
	};
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const monsterName = (monster: unknown): string => {
	const name = (monster as LooseRecord | undefined)?.givenName;
	return typeof name === 'string' ? name.trim() : '';
};

const isDead = (monster: unknown): boolean =>
	Boolean((monster as LooseRecord | undefined)?.dead);

const isDestroyed = (monster: unknown): boolean =>
	Boolean((monster as LooseRecord | undefined)?.destroyed);

const cardSlots = (monster: unknown): number => {
	const slots = (monster as LooseRecord | undefined)?.cardSlots;
	return typeof slots === 'number' && slots > 0 ? slots : DEFAULT_CARD_SLOTS;
};

const isDeckReady = (monster: unknown): boolean =>
	asArray((monster as LooseRecord | undefined)?.cards).length >= cardSlots(monster);

/** Defensive read — this runs inside the command pipeline and must never throw. */
const summonsRemaining = (game: QuickActionsGame, userId: string): number => {
	try {
		return summonAllowance(game?.bossSummons, userId).remaining;
	} catch {
		return 0;
	}
};

export function buildQuickActions(game: QuickActionsGame, userId: string): QuickAction[] {
	const actions: QuickAction[] = [];
	const add = (label: string, command: string): void => {
		if (actions.some((action) => action.command === command)) return;
		actions.push({ label, command });
	};

	const character = game?.characters?.[userId] as LooseRecord | undefined;

	// No character yet — the only meaningful next step is to create a monster,
	// which implicitly creates the character.
	if (!character) {
		return [
			{ label: 'Spawn a monster', command: 'spawn monster' },
			{ label: 'Look at the ring', command: 'look at the ring' },
		];
	}

	const monsters = asArray(character.monsters).filter(
		(monster) => monsterName(monster).length > 0
	);

	if (monsters.length === 0) {
		return [
			{ label: 'Spawn a monster', command: 'spawn monster' },
			{ label: 'Look at the ring', command: 'look at the ring' },
		];
	}

	const contestants = asArray(game?.ring?.contestants);
	const myContestants = contestants.filter((contestant) => {
		const entry = contestant as LooseRecord;
		return entry?.userId === userId && !entry?.isBoss;
	});
	const ringMonsters = new Set<unknown>(
		myContestants
			.map((contestant) => (contestant as LooseRecord).monster)
			.filter((monster) => monster !== undefined && monster !== null)
	);

	const living = monsters.filter((monster) => !isDead(monster) && !isDestroyed(monster));
	const deadRevivable = monsters.filter(
		(monster) => isDead(monster) && !isDestroyed(monster)
	);
	const idleOutOfRing = living.filter((monster) => !ringMonsters.has(monster));
	const readyToSend = idleOutOfRing.filter(isDeckReady);
	// `sendMonsterToTheRing` refuses while *any* of this character's contestants is in
	// the ring — including one that just died there and has not been cleared yet. Match
	// that condition exactly, or the chips offer a send the engine will always refuse.
	const hasMonsterInRing = myContestants.length > 0;
	const unequippedCards = asArray(character.deck).length;

	// Ordered by how likely each is to be the player's actual next move.
	if (hasMonsterInRing) {
		// Waiting in an empty ring is the single most common dead end, so offer the summon
		// ahead of everything else — but only when there is nothing to fight and the player
		// still has a charge left.
		const hasOpponent = contestants.some((contestant) => {
			const entry = contestant as LooseRecord;
			return entry?.isBoss || entry?.userId !== userId;
		});

		if (!hasOpponent && summonsRemaining(game, userId) > 0) {
			add('Summon a boss', 'summon a boss');
		}

		add('Look at the ring', 'look at the ring');
	}

	// Engine allows only one of the player's monsters in the ring at a time.
	const nextToSend = !hasMonsterInRing ? readyToSend[0] : undefined;
	if (nextToSend) {
		add(`Send ${monsterName(nextToSend)} to the ring`, `send ${monsterName(nextToSend)} to the ring`);
	}

	const nextToRevive = deadRevivable[0];
	if (nextToRevive) {
		add(`Revive ${monsterName(nextToRevive)}`, `revive ${monsterName(nextToRevive)}`);
	}

	// Equipping is rejected while a monster is fighting, so only offer it for a
	// monster that is out of the ring. Prefer one that still needs cards — pointing the
	// chip at an already deck-ready monster wastes the suggestion when a bare monster is
	// the thing actually blocking a send.
	const nextToEquip = idleOutOfRing.find((monster) => !isDeckReady(monster)) ?? idleOutOfRing[0];
	if (unequippedCards > 0 && nextToEquip) {
		add(`Equip ${monsterName(nextToEquip)}`, `equip ${monsterName(nextToEquip)}`);
	}

	add('Look at my monsters', 'look at monsters');
	add('Visit the shop', 'visit the shop');

	return actions.slice(0, MAX_QUICK_ACTIONS);
}
