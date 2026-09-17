/* eslint-disable max-len */
import { some } from '../helpers/collection.js';
import BaseCharacter from './base.js';
import { BEASTMASTER } from '../constants/creature-types.js';
import { capitalize } from '../helpers/capitalize.js';
import { monsterCard } from '../helpers/card.js';
import { spawn, equip } from '../monsters/index.js';
import TENSE from '../helpers/tense.js';
import transferItems from '../items/helpers/transfer.js';
import useItems from '../items/helpers/use.js';
import { getItemKey } from '../items/helpers/counts.js';
import { matchesCardLookupName } from '../cards/helpers/matches-lookup-name.js';
import { formatRelative } from '../helpers/time.js';
import { eachSeries } from '../helpers/promise.js';
import { MAX_PRESETS } from '../constants/card-management.js';
import { announceAndThrow } from '../helpers/announce-and-throw.js';
import type { ChannelFn, ChannelWithManager, CardInstance, ItemInstance } from '../creatures/base.js';
import type BaseMonster from '../monsters/base.js';

// Lazy-load choices helper
let _getMonsterChoices: (monsters: BaseMonster[]) => string = monsters =>
	monsters.map((m, i) => `${i}) ${(m as any).givenName ?? m.name}`).join('\n');

const loadHelpers = async () => {
	const choicesModule = await import('../helpers/choices.js').catch(() => null);
	if (choicesModule) {
		_getMonsterChoices =
			(choicesModule as any).getMonsterChoices ?? _getMonsterChoices;
	}
};

export const beastmasterReady = loadHelpers().catch((err) => {
	console.error('[engine] beastmasterReady FAILED — beastmaster helpers will be stubs:', err);
});

const DEFAULT_MONSTER_SLOTS = 7;

const MAX_CARD_COPIES_IN_HAND = 4;

const normalize = (value: string): string => value.trim().toLowerCase();
const getCardName = (card: CardInstance): string =>
	(card as any).cardType ?? (card as any).itemType ?? (card as any).name ?? 'Unknown';
const isSameCardName = (card: CardInstance, cardName: string): boolean =>
	matchesCardLookupName(card as any, cardName);

class Beastmaster extends BaseCharacter {
	constructor(options: Record<string, unknown> = {}) {
		super({
			monsterSlots: DEFAULT_MONSTER_SLOTS,
			...options,
		});
	}

	get monsters(): BaseMonster[] {
		return (this.options.monsters ?? []) as BaseMonster[];
	}

	set monsters(monsters: BaseMonster[]) {
		this.setOptions({ monsters });
	}

	get monsterSlots(): number {
		const stored = this.options.monsterSlots as number | undefined;
		if (!stored || stored < DEFAULT_MONSTER_SLOTS) {
			this.setOptions({ monsterSlots: DEFAULT_MONSTER_SLOTS });
		}
		return (this.options.monsterSlots as number) ?? DEFAULT_MONSTER_SLOTS;
	}

	set monsterSlots(monsterSlots: number) {
		this.setOptions({ monsterSlots });
	}

	canHoldCard(card: CardInstance): boolean {
		if (this.monsters.length > 0) {
			return this.monsters.reduce(
				(canHold: boolean, monster: BaseMonster) =>
					canHold || monster.canHoldCard(card),
				false,
			);
		}
		return super.canHoldCard(card);
	}

	canHoldItem(item: ItemInstance): boolean {
		return (
			super.canHoldItem(item) ||
			this.monsters.reduce(
				(canHold: boolean, monster: BaseMonster) => canHold || monster.canHoldItem(item),
				false,
			)
		);
	}

	canUseItem(item: ItemInstance): boolean {
		return (item as any).usableWithoutMonster && super.canUseItem(item);
	}

	removeCard(cardToRemove: CardInstance): CardInstance | undefined {
		const card = super.removeCard(cardToRemove);
		this.monsters.forEach(monster => monster.resetCards({ matchCard: card }));
		return card;
	}

	addMonster(monster: BaseMonster): void {
		this.monsters = [...this.monsters, monster];
		this.emit('monsterAdded', { monster });
	}

	dropMonster(monsterToBeDropped: BaseMonster): void {
		this.monsters = this.monsters.filter(monster => monster !== monsterToBeDropped);
		this.emit('monsterDropped', { monsterToBeDropped });
	}

	ownsMonster(monsterName: string): boolean {
		return some(
			this.monsters as any[],
			(monster: BaseMonster) =>
				monster.givenName.toLowerCase() === monsterName.toLowerCase(),
		);
	}

	spawnMonster(channel: ChannelFn, options?: Record<string, unknown>): Promise<BaseMonster> {
		const remainingSlots = Math.max(this.monsterSlots - this.monsters.length, 0);

		if (remainingSlots > 0) {
			return Promise.resolve()
				.then(() =>
					channel({
						announce: `You have ${remainingSlots} of ${this.monsterSlots} monsters left to train.`,
					}),
				)
				.then(() => spawn(channel, options as any))
				.then((monster: BaseMonster) => {
					this.addMonster(monster);

					return Promise.resolve()
						.then(() =>
							channel({
								announce: `You're now the proud owner of a ${monster.creatureType}. Before you is ${monsterCard(monster as any)}`,
							}),
						)
						.then(() => monster);
				});
		}

		return announceAndThrow(channel, "You're all out space for new monsters!");
	}

	chooseMonster({
		channel,
		monsters = this.monsters,
		monsterName,
		action = 'pick',
		reason = "you don't appear to have a monster by that name.",
	}: {
		channel: ChannelFn;
		monsters?: BaseMonster[];
		monsterName?: string;
		action?: string;
		reason?: string;
	}): Promise<BaseMonster> {
		return Promise.resolve(monsters.length).then((numberOfMonsters) => {
			if (numberOfMonsters <= 0) {
				return announceAndThrow(channel, `You don't have any monsters to ${action}.`);
			} else if (monsterName) {
				const monster = monsters.find(
					m => m.givenName.toLowerCase() === monsterName.toLowerCase(),
				);

				if (monster) return monster;

				return announceAndThrow(channel, `${monsterName} is not able to ${TENSE[action]?.PAST ?? action} right now, because ${reason}`);
			} else if (numberOfMonsters === 1) {
				return monsters[0];
			}

			return Promise.resolve()
				.then(() =>
					channel({
						question: `Which monster would you like to ${action}?`,
						choices: monsters.map((m: any) => m.givenName ?? m.name ?? 'Unknown'),
					}),
				)
				.then((answer: unknown) => monsters[answer as number]);
		});
	}

	equipMonster({
		monsterName,
		cardSelection,
		channel,
	}: {
		monsterName?: string;
		cardSelection?: string[];
		channel: ChannelFn;
	}): Promise<BaseMonster> {
		const { monsters } = this;

		return Promise.resolve(monsters.length)
			.then((numberOfMonsters) => {
				if (numberOfMonsters <= 0) {
					return announceAndThrow(channel, "You don't have any monsters to equip! You'll need to spawn one first.");
				}
				return this.chooseMonster({ channel, monsters, monsterName, action: 'equip' });
			})
			.then((monster) => {
				const previousCards = [...monster.cards];

				return equip({ deck: this.deck, monster, cardSelection, channel })
					.then(() => this.reconcileDeckAfterEquip(monster, previousCards))
					.then(() => channel({ announce: `${monster.givenName} is good to go!` }))
					.then(() => monster);
			});
	}

	/**
	 * Moves the cards a monster just equipped out of the character's deck, and returns
	 * anything it was holding but no longer holds.
	 *
	 * `character.deck` is the **unequipped pool** — `unequipAll` returns cards to it via
	 * `addCard`, and `equipCards` (web workshop) and `loadPreset` both splice equipped
	 * cards out of it. The console `equip` command was the one path that never did:
	 * `monsters/helpers/equip.ts` assigns `monster.cards` but has no reference to the
	 * character, so the equipped cards stayed in the deck as well. The very same card
	 * *instances* then sat in both places.
	 *
	 * That made every console equip → `clear deck` cycle permanently duplicate cards:
	 * equipping left them in the deck, and clearing added them back a second time. A
	 * three-card deck became five, then seven, growing without bound in the saved state
	 * and bloating the equip prompt's card list on every cycle (#91).
	 *
	 * Removal is by object identity, not by name: duplicate card types are legitimate
	 * (up to four copies per hand), so matching by name would evict the wrong instance.
	 * The return path also checks identity before re-adding, so a deck already corrupted
	 * by this bug is not corrupted further — it converges as monsters are re-equipped.
	 */
	private reconcileDeckAfterEquip(monster: BaseMonster, previousCards: CardInstance[]): void {
		const equipped = monster.cards as CardInstance[];

		// Filtering preserves the deck's existing alphabetical order.
		this.deck = this.deck.filter(card => !equipped.includes(card));

		// `addCard` sorts on insert and emits `cardAdded`, so returns behave exactly as
		// they do in `unequipAll`.
		previousCards.forEach((card) => {
			if (!equipped.includes(card) && !this.deck.includes(card)) this.addCard(card);
		});
	}

	giveItemsToMonster({
		monsterName,
		itemSelection,
		channel,
	}: {
		monsterName?: string;
		itemSelection?: string[];
		channel: ChannelFn;
	}): Promise<BaseMonster> {
		const { monsters } = this;

		return Promise.resolve(monsters.length)
			.then((numberOfMonsters) => {
				if (numberOfMonsters <= 0) {
					return announceAndThrow(channel, "You don't have any monsters to give items to! You'll need to spawn one first.");
				}
				return this.chooseMonster({ channel, monsters, monsterName, action: 'give items to' });
			})
			.then(monster =>
				transferItems({ from: this as any, to: monster as any, itemSelection, channel: channel as any }).then(
					() => monster,
				),
			);
	}

	takeItemsFromMonster({
		monsterName,
		itemSelection,
		channel,
	}: {
		monsterName?: string;
		itemSelection?: string[];
		channel: ChannelFn;
	}): Promise<BaseMonster> {
		const { monsters } = this;

		return Promise.resolve(monsters.length)
			.then((numberOfMonsters) => {
				if (numberOfMonsters <= 0) {
					return announceAndThrow(channel, "You don't have any monsters to take items from! You'll need to spawn one first.");
				}
				return this.chooseMonster({ channel, monsters, monsterName, action: 'take items from' });
			})
			.then(monster =>
				transferItems({ from: monster as any, to: this as any, itemSelection, channel: channel as any }).then(
					() => monster,
				),
			);
	}

	/**
	 * Use items, including **during a fight** — but only ones the monster is already
	 * carrying.
	 *
	 * There is no `monster.inEncounter` guard here, unlike `equipMonster`, `moveCard`,
	 * `giveItemsToMonster`, `takeItemsFromMonster` and `reviveMonster`, which all refuse
	 * outright. That is deliberate: items are the single lever a player still holds once a
	 * fight is running, and item power is balanced on the assumption they can be used then.
	 *
	 * **The guard exists, one level down, and it is the interesting part.** `items/helpers/
	 * use.ts` builds the usable pool from `monster.items` alone while `monster.inEncounter`,
	 * adding the character's own items only when the monster is NOT in an encounter. And
	 * `items/helpers/transfer.ts` refuses to move items to or from a monster in an
	 * encounter. So mid-fight you can use what the monster took into the ring with it, and
	 * nothing else.
	 *
	 * That makes stocking a monster before it fights a commitment decision in its own
	 * right, exactly like building its deck — which is the game's shape, not an accident.
	 * Do not "fix" the apparent inconsistency here: it would remove the game's only
	 * real-time decision. See `docs/roadmap/19-player-agency-and-items.md` §3.
	 */
	useItems({
		channel,
		channelName,
		confirmed,
		isMonsterItem,
		itemSelection,
		itemSource,
		monsterName,
	}: {
		channel: ChannelFn;
		channelName?: string;
		/** See `items/helpers/use.ts` — set by callers whose UI already confirmed. */
		confirmed?: boolean;
		isMonsterItem?: boolean;
		itemSelection?: string[];
		/** See `items/helpers/use.ts` — disambiguates a type held in both pools. */
		itemSource?: 'character' | 'monster';
		monsterName?: string;
		/**
		 * Resolves with each used item's `action` result. An item whose conditions are not
		 * met (Spin Up on a living monster, a healing potion on a dead one) returns `false`
		 * and is deliberately *not* consumed, so a caller that reports success regardless
		 * tells the player something happened when nothing did.
		 */
	}): Promise<unknown[]> {
		return Promise.resolve()
			.then(() => {
				if (monsterName || isMonsterItem) {
					const { monsters } = this;
					return Promise.resolve().then(() =>
						this.chooseMonster({ channel, monsters, monsterName, action: 'use items on' }),
					);
				}
				return undefined;
			})
			.then((monster: BaseMonster | undefined) =>
				useItems({
					channel: channel as any,
					character: this as any,
					confirmed,
					itemSelection,
					itemSource,
					monster: monster as any,
					use: (options: any) => this.useItem({ channelName, ...options }),
				}),
			);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	override useItem({
		channel,
		channelName,
		isMonsterItem,
		item,
		monster,
		monsterName,
	}: {
		channel?: ChannelFn;
		channelName?: string;
		isMonsterItem?: boolean;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		item?: any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		monster?: any;
		monsterName?: string;
	}): Promise<unknown> {
		if (!monster && (monsterName || isMonsterItem)) {
			const { monsters } = this;
			return Promise.resolve()
				.then(() =>
					this.chooseMonster({ channel: channel!, monsters, monsterName, action: 'use the item on' }),
				)
				.then((foundMonster: BaseMonster) =>
					super.useItem({ channel: channel as ChannelFn, channelName, item, monster: foundMonster as any }),
				);
		}
		return super.useItem({ channel: channel as ChannelFn, channelName, item, monster: monster as any });
	}

	lookAtItems(channel: ChannelWithManager): Promise<void> {
		const { channelManager, channelName } = channel;

		return Promise.resolve()
			.then(() => { if (this.items.length) return super.lookAtItems(channel as any); })
			.then(() =>
				eachSeries(this.monsters as any[], (monster: BaseMonster) => {
					if ((monster as any).items.length < 1) return Promise.resolve();

					return Promise.resolve(
						channelManager.queueMessage({
							announce: `${monster.givenName}'s Items:`,
							channel: channel as any,
							channelName,
						}),
					).then(() => super.lookAtItems(channel as any, (monster as any).items));
				}),
			);
	}

	lookAtCardInventory(channel: ChannelFn): Promise<void> {
		const lines: string[] = ['Your Card Inventory', '===================', ''];

		this.monsters.forEach((monster) => {
			lines.push(
				`${monster.givenName} [${monster.creatureType}, L${monster.level}]  ${monster.cards.length}/${monster.cardSlots} slots`,
			);

			if (monster.cards.length < 1) {
				lines.push('  (empty)');
			} else {
				monster.cards.forEach((card, index) => {
					lines.push(`  ${index + 1}) ${getCardName(card)}`);
				});
			}

			lines.push('');
		});

		const deckCounts = this.deck.reduce<Record<string, number>>((counts, card) => {
			const key = getItemKey(card);
			counts[key] = (counts[key] ?? 0) + 1;
			return counts;
		}, {});

		const deckList = Object.entries(deckCounts)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([name, count]) => (count > 1 ? `${name} x${count}` : name));

		lines.push(`Unequipped (${this.deck.length} cards)`);
		lines.push(deckList.length > 0 ? `  ${deckList.join(', ')}` : '  (none)');

		return Promise.resolve().then(() => {
			channel({ announce: lines.join('\n') });
		});
	}

	async lookAtInventory(channel: ChannelWithManager): Promise<void> {
		const hasItems =
			this.items.length > 0 ||
			this.monsters.some(monster => (monster as any).items?.length > 0);

		await this.lookAtCardInventory(channel as ChannelFn);

		if (!hasItems) {
			await channel({ announce: 'Items:\n  (none)' });
			return;
		}

		await this.lookAtItems(channel);
	}

	private findMonsterByName(monsterName: string): BaseMonster | undefined {
		return this.monsters.find(monster => normalize(monster.givenName) === normalize(monsterName));
	}

	private getMonsterPresets(monster: BaseMonster): Record<string, string[]> {
		const presets = ((monster.options as Record<string, unknown>).presets ??
			{}) as Record<string, string[]>;
		return Object.entries(presets).reduce<Record<string, string[]>>((all, [name, cards]) => {
			if (!Array.isArray(cards)) return all;
			all[name] = cards.filter(card => typeof card === 'string');
			return all;
		}, {});
	}

	/**
	 * Resolves a preset name to the key it is actually stored under, ignoring
	 * case and surrounding whitespace.
	 *
	 * Preset names reach the engine two ways with different casing: the text
	 * command parser lowercases the whole command string (see
	 * `commands/index.ts`), while the web workshop passes the tRPC input
	 * verbatim. A preset saved as "Aggro" in the workshop was therefore
	 * invisible to `load preset aggro on ...` from Discord or a DM, because
	 * lookups were exact-match on the stored key. Resolve case-insensitively so
	 * a preset is reachable from every connector regardless of where it was
	 * saved.
	 */
	private resolvePresetKey(
		presets: Record<string, string[]>,
		presetName: string
	): string | undefined {
		const target = normalize(presetName);
		return Object.keys(presets).find(key => normalize(key) === target);
	}

	getPresets(monsterName?: string): Record<string, string[]> | Record<string, Record<string, string[]>> {
		if (monsterName) {
			const monster = this.findMonsterByName(monsterName);
			if (!monster) return {};
			return this.getMonsterPresets(monster);
		}

		return this.monsters.reduce<Record<string, Record<string, string[]>>>((all, monster) => {
			all[monster.givenName] = this.getMonsterPresets(monster);
			return all;
		}, {});
	}

	unequipCard({
		cardName,
		monsterName,
		count = 1,
		channel,
	}: {
		cardName: string;
		monsterName?: string;
		count?: number;
		channel: ChannelFn;
	}): Promise<{ removedCount: number; monsterName: string }> {
		const removeCount = Math.max(Number(count) || 1, 1);

		return Promise.resolve()
			.then(() =>
				this.chooseMonster({
					channel,
					monsterName,
					action: 'unequip from',
					reason: "you don't appear to have a monster by that name.",
				}),
			)
			.then((monster) => {
				if (monster.inEncounter) {
					return announceAndThrow(
						channel,
						`You cannot unequip cards from ${monster.givenName} while they are fighting!`,
					);
				}

				const remainingCards = [...monster.cards];
				const removedCards: CardInstance[] = [];

				while (removedCards.length < removeCount) {
					const cardIndex = remainingCards.findIndex(card =>
						isSameCardName(card, cardName),
					);
					if (cardIndex < 0) break;
					removedCards.push(remainingCards.splice(cardIndex, 1)[0]);
				}

				if (removedCards.length < 1) {
					return announceAndThrow(channel, `${monster.givenName} is not holding ${cardName}.`);
				}

				monster.cards = remainingCards;
				removedCards.forEach(card => this.addCard(card));

				return Promise.resolve(channel({
					announce: `Unequipped ${removedCards.length} ${cardName}${removedCards.length === 1 ? '' : ' cards'} from ${monster.givenName}.`,
				})).then(
					() =>
						({
							removedCount: removedCards.length,
							monsterName: monster.givenName,
						}) as { removedCount: number; monsterName: string },
				);
			});
	}

	unequipAll({
		monsterName,
		channel,
	}: {
		monsterName?: string;
		channel: ChannelFn;
	}): Promise<{ removedCount: number; monsterName: string }> {
		return Promise.resolve()
			.then(() =>
				this.chooseMonster({
					channel,
					monsterName,
					action: 'clear',
					reason: "you don't appear to have a monster by that name.",
				}),
			)
			.then((monster) => {
				if (monster.inEncounter) {
					return announceAndThrow(
						channel,
						`You cannot clear ${monster.givenName}'s deck while they are fighting!`,
					);
				}

				if (monster.cards.length < 1) {
					return announceAndThrow(channel, `${monster.givenName} already has an empty deck.`);
				}

				const previousCards = [...monster.cards];
				monster.cards = [];
				previousCards.forEach(card => this.addCard(card));

				return Promise.resolve(channel({
					announce: `${monster.givenName}'s deck has been cleared (${previousCards.length} cards returned).`,
				})).then(
					() =>
						({
							removedCount: previousCards.length,
							monsterName: monster.givenName,
						}) as { removedCount: number; monsterName: string },
				);
			});
	}

	moveCard({
		cardName,
		fromMonsterName,
		toMonsterName,
		count = 1,
		channel,
	}: {
		cardName: string;
		fromMonsterName: string;
		toMonsterName: string;
		count?: number;
		channel: ChannelFn;
	}): Promise<{ movedCount: number; fromMonsterName: string; toMonsterName: string }> {
		const moveCount = Math.max(Number(count) || 1, 1);
		const fromMonster = this.findMonsterByName(fromMonsterName);
		const toMonster = this.findMonsterByName(toMonsterName);

		if (!fromMonster) {
			return announceAndThrow(channel, `I can find no monster named ${fromMonsterName}.`);
		}
		if (!toMonster) {
			return announceAndThrow(channel, `I can find no monster named ${toMonsterName}.`);
		}
		if (fromMonster === toMonster) {
			return announceAndThrow(channel, 'Choose two different monsters for move operations.');
		}
		if (fromMonster.inEncounter || toMonster.inEncounter) {
			return announceAndThrow(channel, 'Cards cannot be moved while a monster is in battle.');
		}

		const sourceCards = [...fromMonster.cards];
		const targetCards = [...toMonster.cards];
		let movedCount = 0;
		let blockedBy = '';

		while (movedCount < moveCount) {
			const cardIndex = sourceCards.findIndex(card => isSameCardName(card, cardName));
			if (cardIndex < 0) break;

			const card = sourceCards[cardIndex];
			const targetCount = targetCards.filter(
				existing => getItemKey(existing) === getItemKey(card),
			).length;

			if (targetCards.length >= toMonster.cardSlots) {
				blockedBy = `${toMonster.givenName} has no free slots.`;
				break;
			}
			if (!toMonster.canHoldCard(card)) {
				blockedBy = `${toMonster.givenName} cannot hold ${getCardName(card)}.`;
				break;
			}
			if (targetCount >= MAX_CARD_COPIES_IN_HAND) {
				blockedBy = `${toMonster.givenName} already has ${MAX_CARD_COPIES_IN_HAND} copies of ${getCardName(card)}.`;
				break;
			}

			sourceCards.splice(cardIndex, 1);
			targetCards.push(card);
			movedCount += 1;
		}

		if (movedCount < 1) {
			const reason = blockedBy || `${fromMonster.givenName} is not holding ${cardName}.`;
			return announceAndThrow(channel, reason);
		}

		fromMonster.cards = sourceCards;
		toMonster.cards = targetCards;

		return Promise.resolve(channel({
			announce: `Moved ${movedCount} ${cardName}${movedCount === 1 ? '' : ' cards'} from ${fromMonster.givenName} to ${toMonster.givenName}.${blockedBy ? ` ${blockedBy}` : ''}`,
		})).then(() => ({
			movedCount,
			fromMonsterName: fromMonster.givenName,
			toMonsterName: toMonster.givenName,
		}));
	}

	reorderCards({
		monsterName,
		fromIndex,
		toIndex,
		channel,
	}: {
		monsterName: string;
		fromIndex: number;
		toIndex: number;
		channel: ChannelFn;
	}): Promise<{ monsterName: string; movedCard: string; fromIndex: number; toIndex: number; cards: string[] }> {
		const monster = this.findMonsterByName(monsterName);
		if (!monster) {
			return announceAndThrow(channel, `I can find no monster named ${monsterName}.`);
		}
		if (monster.inEncounter) {
			return announceAndThrow(channel, `You cannot reorder ${monster.givenName}'s cards while they are fighting!`);
		}

		const cards = [...monster.cards];
		if (cards.length < 2) {
			return announceAndThrow(channel, `${monster.givenName} needs at least 2 cards to reorder.`);
		}

		const from = Number.isInteger(fromIndex) ? fromIndex : Number.parseInt(String(fromIndex), 10);
		const to = Number.isInteger(toIndex) ? toIndex : Number.parseInt(String(toIndex), 10);
		if (!Number.isFinite(from) || !Number.isFinite(to)) {
			return announceAndThrow(channel, 'Card reorder indices must be valid numbers.');
		}
		if (from < 0 || from >= cards.length || to < 0 || to >= cards.length) {
			return announceAndThrow(
				channel,
				`Card reorder indices must be between 0 and ${cards.length - 1}.`,
			);
		}
		if (from === to) {
			const names = cards.map(card => getCardName(card));
			return Promise.resolve(channel({
				announce: `${monster.givenName}'s card order is unchanged.`,
			})).then(() => ({
				monsterName: monster.givenName,
				movedCard: getCardName(cards[from]),
				fromIndex: from,
				toIndex: to,
				cards: names,
			}));
		}

		const movedCard = cards.splice(from, 1)[0];
		cards.splice(to, 0, movedCard);
		monster.cards = cards;
		const names = cards.map(card => getCardName(card));

		return Promise.resolve(channel({
			announce: `Reordered ${monster.givenName}'s deck: moved ${getCardName(movedCard)} from slot ${from + 1} to ${to + 1}.`,
		})).then(() => ({
			monsterName: monster.givenName,
			movedCard: getCardName(movedCard),
			fromIndex: from,
			toIndex: to,
			cards: names,
		}));
	}

	moveCards({
		cardNames,
		fromMonsterName,
		toMonsterName,
		channel,
	}: {
		cardNames: string[];
		fromMonsterName: string;
		toMonsterName: string;
		channel: ChannelFn;
	}): Promise<{ movedCards: string[] }> {
		const movedCards: string[] = [];

		return eachSeries(cardNames, (cardName: string) =>
			this.moveCard({ cardName, fromMonsterName, toMonsterName, channel })
				.then(() => {
					movedCards.push(cardName);
				})
				.catch(() => undefined),
		).then(() => ({ movedCards }));
	}

	equipCards({
		monsterName,
		cardNames,
		replaceAll = false,
		channel,
	}: {
		monsterName?: string;
		cardNames: string[];
		replaceAll?: boolean;
		channel: ChannelFn;
	}): Promise<{ equipped: number; requested: number; skippedCards: string[]; monsterName: string }> {
		return Promise.resolve()
			.then(() =>
				this.chooseMonster({
					channel,
					monsterName,
					action: 'equip',
					reason: "you don't appear to have a monster by that name.",
				}),
			)
			.then((monster) => {
				if (monster.inEncounter) {
					return announceAndThrow(
						channel,
						`You cannot equip ${monster.givenName} while they are fighting!`,
					);
				}

				const requested = cardNames.length;
				const skippedCards: string[] = [];
				let deck = [...this.deck];
				let nextCards = replaceAll ? [] : [...monster.cards];

				if (replaceAll) {
					monster.cards.forEach(card => this.addCard(card));
					deck = [...this.deck];
				}

				cardNames.forEach((cardName) => {
					if (nextCards.length >= monster.cardSlots) {
						skippedCards.push(cardName);
						return;
					}

					const cardIndex = deck.findIndex(card =>
						isSameCardName(card, cardName) && monster.canHoldCard(card),
					);
					if (cardIndex < 0) {
						skippedCards.push(cardName);
						return;
					}

					const selectedCard = deck[cardIndex];
					const cardCount = nextCards.filter(
						card => getItemKey(card) === getItemKey(selectedCard),
					).length;
					if (cardCount >= MAX_CARD_COPIES_IN_HAND) {
						skippedCards.push(cardName);
						return;
					}

					nextCards.push(deck.splice(cardIndex, 1)[0]);
				});

				this.deck = deck;
				monster.cards = nextCards;

				const equipped = requested - skippedCards.length;
				const summary = {
					equipped,
					requested,
					skippedCards,
					monsterName: monster.givenName,
				};

				return Promise.resolve(channel({
					announce: `Equipped ${monster.givenName}: ${equipped}/${requested}${skippedCards.length > 0 ? ` (skipped: ${skippedCards.join(', ')})` : ''}.`,
				})).then(() => summary);
			});
	}

	savePreset({
		presetName,
		monsterName,
		channel,
	}: {
		presetName: string;
		monsterName?: string;
		channel: ChannelFn;
	}): Promise<{ presetName: string; monsterName: string }> {
		const trimmedName = presetName.trim();
		if (!trimmedName) {
			return announceAndThrow(channel, 'Preset name is required.');
		}

		return Promise.resolve()
			.then(() =>
				this.chooseMonster({
					channel,
					monsterName,
					action: 'save a preset for',
				}),
			)
			.then((monster) => {
				const presets = this.getMonsterPresets(monster);
				// Reuse the existing key so re-saving under different casing updates
				// the preset in place instead of creating a near-duplicate.
				const existingKey = this.resolvePresetKey(presets, trimmedName);
				if (!existingKey && Object.keys(presets).length >= MAX_PRESETS) {
					return announceAndThrow(
						channel,
						`${monster.givenName} already has ${MAX_PRESETS} presets. Delete one before saving another.`,
					);
				}

				const nextPresets = {
					...presets,
					[existingKey ?? trimmedName]: monster.cards.map(card => getCardName(card)),
				};
				monster.setOptions({ presets: nextPresets });

				return Promise.resolve(channel({
					announce: `Saved preset "${trimmedName}" for ${monster.givenName}.`,
				})).then(
					() =>
						({
							presetName: trimmedName,
							monsterName: monster.givenName,
						}) as { presetName: string; monsterName: string },
				);
			});
	}

	loadPreset({
		presetName,
		monsterName,
		channel,
	}: {
		presetName: string;
		monsterName?: string;
		channel: ChannelFn;
	}): Promise<{ equipped: number; requested: number; skippedCards: string[]; presetName: string; monsterName: string }> {
		const trimmedName = presetName.trim();
		if (!trimmedName) {
			return announceAndThrow(channel, 'Preset name is required.');
		}

		return Promise.resolve()
			.then(() =>
				this.chooseMonster({
					channel,
					monsterName,
					action: 'load a preset for',
				}),
			)
			.then((monster) => {
				if (monster.inEncounter) {
					return announceAndThrow(
						channel,
						`You cannot load presets for ${monster.givenName} while they are fighting!`,
					);
				}

				const presets = this.getMonsterPresets(monster);
				const presetKey = this.resolvePresetKey(presets, trimmedName);
				const requestedCards = presetKey === undefined ? undefined : presets[presetKey];
				if (!requestedCards) {
					return announceAndThrow(
						channel,
						`No preset named "${trimmedName}" exists for ${monster.givenName}.`,
					);
				}

				const oldCards = [...monster.cards];
				oldCards.forEach(card => this.addCard(card));

				let deck = [...this.deck];
				const nextCards: CardInstance[] = [];
				const skippedCards: string[] = [];

				requestedCards.forEach((requestedCard) => {
					if (nextCards.length >= monster.cardSlots) {
						skippedCards.push(requestedCard);
						return;
					}

					const requestedKey = normalize(String(requestedCard));
					const selectedCount = nextCards.filter(
						card => normalize(getItemKey(card)) === requestedKey,
					).length;
					if (selectedCount >= MAX_CARD_COPIES_IN_HAND) {
						skippedCards.push(requestedCard);
						return;
					}

					const cardIndex = deck.findIndex(card =>
						isSameCardName(card, requestedCard) && monster.canHoldCard(card),
					);
					if (cardIndex < 0) {
						skippedCards.push(requestedCard);
						return;
					}

					nextCards.push(deck.splice(cardIndex, 1)[0]);
				});

				this.deck = deck;
				monster.cards = nextCards;

				const summary = {
					equipped: nextCards.length,
					requested: requestedCards.length,
					skippedCards,
					presetName: trimmedName,
					monsterName: monster.givenName,
				};

				return Promise.resolve(channel({
					announce: `Loaded preset "${trimmedName}" on ${monster.givenName}: equipped ${summary.equipped}/${summary.requested}${skippedCards.length > 0 ? ` (skipped: ${skippedCards.join(', ')})` : ''}.`,
				})).then(() => summary);
			});
	}

	deletePreset({
		presetName,
		monsterName,
		channel,
	}: {
		presetName: string;
		monsterName?: string;
		channel: ChannelFn;
	}): Promise<{ presetName: string; monsterName: string }> {
		const trimmedName = presetName.trim();
		if (!trimmedName) {
			return announceAndThrow(channel, 'Preset name is required.');
		}

		return Promise.resolve()
			.then(() =>
				this.chooseMonster({
					channel,
					monsterName,
					action: 'delete a preset for',
				}),
			)
			.then((monster) => {
				const presets = this.getMonsterPresets(monster);
				const presetKey = this.resolvePresetKey(presets, trimmedName);
				if (presetKey === undefined) {
					return announceAndThrow(
						channel,
						`No preset named "${trimmedName}" exists for ${monster.givenName}.`,
					);
				}

				const nextPresets = { ...presets };
				delete nextPresets[presetKey];
				monster.setOptions({ presets: nextPresets });

				return Promise.resolve(channel({
					announce: `Deleted preset "${trimmedName}" for ${monster.givenName}.`,
				})).then(
					() =>
						({
							presetName: trimmedName,
							monsterName: monster.givenName,
						}) as { presetName: string; monsterName: string },
				);
			});
	}

	callMonsterOutOfTheRing({
		monsterName,
		ring,
		channel,
		channelName,
		userId,
	}: {
		monsterName?: string;
		ring: any;
		channel: ChannelFn;
		channelName?: string;
		userId?: string;
	}): Promise<unknown> {
		const monsters = ring.getMonsters(this);

		if (monsters.length <= 0) {
			return announceAndThrow(channel, "It doesn't look like any of your monsters are in the ring right now.");
		}

		return Promise.resolve()
			.then(() =>
				this.chooseMonster({
					channel,
					monsters,
					monsterName,
					action: 'call from the ring',
					reason: 'they do not appear to be in the ring.',
				}),
			)
			.then((monsterInRing: BaseMonster) =>
				ring.removeMonster({ monster: monsterInRing, character: this, channel, channelName, userId }),
			);
	}

	sendMonsterToTheRing({
		monsterName,
		ring,
		channel,
		channelName,
		userId,
	}: {
		monsterName?: string;
		ring: any;
		channel: ChannelFn;
		channelName?: string;
		userId: string;
	}): Promise<unknown> {
		const character = this;
		const alreadyInRing = ring.contestants.filter(
			(contestant: any) => contestant.character === character,
		);
		const monsters = this.monsters.filter(monster => !monster.dead);

		return Promise.resolve(monsters.length).then((numberOfMonsters) => {
			if (alreadyInRing && alreadyInRing.length > 0) {
				return announceAndThrow(channel, 'You already have a monster in the ring!');
			} else if (numberOfMonsters <= 0) {
				return announceAndThrow(channel, "You don't have any living monsters to send into battle. Spawn one first, or wait for your dead monsters to revive.");
			}

			return this.chooseMonster({
				channel,
				monsters,
				monsterName,
				action: 'send into battle',
				reason: "you don't appear to have a monster by that name.",
			}).then((monster: BaseMonster) => {
				if (monster.cards.length < monster.cardSlots) {
					return announceAndThrow(channel, 'Only an evil master would send their monster into battle without enough cards.');
				}
				return ring.addMonster({ monster, character, userId });
			});
		});
	}

	dismissMonster({
		monsterName,
		channel,
	}: {
		monsterName?: string;
		channel: ChannelFn;
	}): Promise<BaseMonster> {
		const monsters = this.monsters.filter(monster => monster.dead);

		return Promise.resolve(monsters.length)
			.then((numberOfMonsters) => {
				if (numberOfMonsters <= 0) {
					return announceAndThrow(channel, "You don't have any monsters eligible for dismissal.");
				}
				return this.chooseMonster({
					channel,
					monsters,
					monsterName,
					action: 'dismiss',
					reason: "you don't appear to have a defeated monster by that name.",
				});
			})
			.then((monster: BaseMonster) => {
				this.dropMonster(monster);
				return monster;
			})
		.then((monster: BaseMonster) =>
			// "Dismissed from your pack" was kennel language for what is always a *dead*
			// monster (this command filters on `monster.dead`), and it carried the game's
			// last bit of livestock framing on the player side. "Laid to rest" suits
			// permadeath and matches the companion voice the ring narration now uses —
			// a beastmaster calls monsters in and calls them back, rather than owning
			// stock. See 10b-bugs-fixed.md #104.
			(channel({ announce: `${monster.givenName} has been laid to rest.` }) as Promise<unknown>).then(
				() => monster,
			),
		);
	}

	reviveMonster({
		monsterName,
		channel,
	}: {
		monsterName?: string;
		channel: ChannelFn;
	}): Promise<BaseMonster> {
		const monsters = this.monsters.filter(monster => monster.dead && !monster.inEncounter);

		return Promise.resolve(monsters.length)
			.then((numberOfMonsters) => {
				if (numberOfMonsters <= 0) {
					return announceAndThrow(channel, "You don't have any monsters to revive.");
				}
				return this.chooseMonster({
					channel,
					monsters,
					monsterName,
					action: 'revive',
					reason: "you don't appear to have a defeated monster by that name.",
				});
			})
			.then((monster: BaseMonster) => {
				const timeToRevive = (monster as any).respawn();
				const reviveStatement = (monster as any).respawnTimeoutLength
					? formatRelative(timeToRevive, (monster as any).respawnTimeoutBegan)
					: 'instantly';

			return (channel({
				announce: `${monster.givenName} has begun to revive. ${capitalize(monster.pronouns.he)} is a ${(monster as any).displayLevel} monster, and therefore will be revived ${reviveStatement}.`,
			}) as Promise<unknown>).then(() => monster);
			});
	}
}

Beastmaster.creatureType = BEASTMASTER;

export { Beastmaster };
export default Beastmaster;
