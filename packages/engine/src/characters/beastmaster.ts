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
import { formatRelative } from '../helpers/time.js';
import { eachSeries } from '../helpers/promise.js';
import { MAX_PRESETS } from '../constants/card-management.js';
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
	getCardName(card).toLowerCase() === cardName.toLowerCase();

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

		return Promise.reject(
			channel({ announce: "You're all out space for new monsters!" }),
		) as unknown as Promise<BaseMonster>;
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
				return Promise.reject(
					channel({ announce: `You don't have any monsters to ${action}.` }),
				) as unknown as BaseMonster;
			} else if (monsterName) {
				const monster = monsters.find(
					m => m.givenName.toLowerCase() === monsterName.toLowerCase(),
				);

				if (monster) return monster;

				return Promise.reject(
					channel({
						announce: `${monsterName} is not able to ${TENSE[action]?.PAST ?? action} right now, because ${reason}`,
					}),
				) as unknown as BaseMonster;
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
					return Promise.reject(
						channel({
							announce: "You don't have any monsters to equip! You'll need to spawn one first.",
						}),
					) as unknown as BaseMonster;
				}
				return this.chooseMonster({ channel, monsters, monsterName, action: 'equip' });
			})
			.then(monster =>
				equip({ deck: this.deck, monster, cardSelection, channel })
					.then(() => channel({ announce: `${monster.givenName} is good to go!` }))
					.then(() => monster),
			);
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
					return Promise.reject(
						channel({
							announce: "You don't have any monsters to give items to! You'll need to spawn one first.",
						}),
					) as unknown as BaseMonster;
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
					return Promise.reject(
						channel({
							announce: "You don't have any monsters to take items from! You'll need to spawn one first.",
						}),
					) as unknown as BaseMonster;
				}
				return this.chooseMonster({ channel, monsters, monsterName, action: 'take items from' });
			})
			.then(monster =>
				transferItems({ from: monster as any, to: this as any, itemSelection, channel: channel as any }).then(
					() => monster,
				),
			);
	}

	useItems({
		channel,
		channelName,
		isMonsterItem,
		itemSelection,
		monsterName,
	}: {
		channel: ChannelFn;
		channelName?: string;
		isMonsterItem?: boolean;
		itemSelection?: string[];
		monsterName?: string;
	}): Promise<void> {
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
					itemSelection,
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

	lookAtInventory(channel: ChannelWithManager): Promise<void> {
		const hasItems =
			this.items.length > 0 ||
			this.monsters.some(monster => (monster as any).items?.length > 0);

		return Promise.resolve()
			.then(() => this.lookAtCardInventory(channel as ChannelFn))
			.then(() => {
				if (!hasItems) {
					return channel({ announce: 'Items:\n  (none)' });
				}

				return this.lookAtItems(channel);
			});
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
					return Promise.reject(
						channel({
							announce: `You cannot unequip cards from ${monster.givenName} while they are fighting!`,
						}),
					) as unknown as { removedCount: number; monsterName: string };
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
					return Promise.reject(
						channel({ announce: `${monster.givenName} is not holding ${cardName}.` }),
					) as unknown as { removedCount: number; monsterName: string };
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
					return Promise.reject(
						channel({
							announce: `You cannot clear ${monster.givenName}'s deck while they are fighting!`,
						}),
					) as unknown as { removedCount: number; monsterName: string };
				}

				if (monster.cards.length < 1) {
					return Promise.reject(
						channel({ announce: `${monster.givenName} already has an empty deck.` }),
					) as unknown as { removedCount: number; monsterName: string };
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
			return Promise.reject(
				channel({ announce: `I can find no monster named ${fromMonsterName}.` }),
			) as Promise<{ movedCount: number; fromMonsterName: string; toMonsterName: string }>;
		}
		if (!toMonster) {
			return Promise.reject(
				channel({ announce: `I can find no monster named ${toMonsterName}.` }),
			) as Promise<{ movedCount: number; fromMonsterName: string; toMonsterName: string }>;
		}
		if (fromMonster === toMonster) {
			return Promise.reject(
				channel({ announce: 'Choose two different monsters for move operations.' }),
			) as Promise<{ movedCount: number; fromMonsterName: string; toMonsterName: string }>;
		}
		if (fromMonster.inEncounter || toMonster.inEncounter) {
			return Promise.reject(
				channel({ announce: 'Cards cannot be moved while a monster is in battle.' }),
			) as Promise<{ movedCount: number; fromMonsterName: string; toMonsterName: string }>;
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
			return Promise.reject(channel({ announce: reason })) as Promise<{
				movedCount: number;
				fromMonsterName: string;
				toMonsterName: string;
			}>;
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
					return Promise.reject(
						channel({
							announce: `You cannot equip ${monster.givenName} while they are fighting!`,
						}),
					) as unknown as {
						equipped: number;
						requested: number;
						skippedCards: string[];
						monsterName: string;
					};
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
			return Promise.reject(channel({ announce: 'Preset name is required.' })) as Promise<{
				presetName: string;
				monsterName: string;
			}>;
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
				const hasPreset = Object.prototype.hasOwnProperty.call(presets, trimmedName);
				if (!hasPreset && Object.keys(presets).length >= MAX_PRESETS) {
					return Promise.reject(
						channel({
							announce: `${monster.givenName} already has ${MAX_PRESETS} presets. Delete one before saving another.`,
						}),
					) as unknown as { presetName: string; monsterName: string };
				}

				const nextPresets = {
					...presets,
					[trimmedName]: monster.cards.map(card => getCardName(card)),
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
			return Promise.reject(channel({ announce: 'Preset name is required.' })) as Promise<{
				equipped: number;
				requested: number;
				skippedCards: string[];
				presetName: string;
				monsterName: string;
			}>;
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
					return Promise.reject(
						channel({
							announce: `You cannot load presets for ${monster.givenName} while they are fighting!`,
						}),
					) as unknown as {
						equipped: number;
						requested: number;
						skippedCards: string[];
						presetName: string;
						monsterName: string;
					};
				}

				const presets = this.getMonsterPresets(monster);
				const requestedCards = presets[trimmedName];
				if (!requestedCards) {
					return Promise.reject(
						channel({
							announce: `No preset named "${trimmedName}" exists for ${monster.givenName}.`,
						}),
					) as unknown as {
						equipped: number;
						requested: number;
						skippedCards: string[];
						presetName: string;
						monsterName: string;
					};
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

					const selectedCount = nextCards.filter(
						card => getItemKey(card) === requestedCard,
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
			return Promise.reject(channel({ announce: 'Preset name is required.' })) as Promise<{
				presetName: string;
				monsterName: string;
			}>;
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
				if (!Object.prototype.hasOwnProperty.call(presets, trimmedName)) {
					return Promise.reject(
						channel({
							announce: `No preset named "${trimmedName}" exists for ${monster.givenName}.`,
						}),
					) as unknown as { presetName: string; monsterName: string };
				}

				const nextPresets = { ...presets };
				delete nextPresets[trimmedName];
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
	}: {
		monsterName?: string;
		ring: any;
		channel: ChannelFn;
		channelName?: string;
	}): Promise<unknown> {
		const monsters = ring.getMonsters(this);

		if (monsters.length <= 0) {
			return Promise.reject(
				channel({
					announce: "It doesn't look like any of your monsters are in the ring right now.",
				}),
			);
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
				ring.removeMonster({ monster: monsterInRing, character: this, channel, channelName }),
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
				return Promise.reject(
					channel({ announce: 'You already have a monster in the ring!' }),
				);
			} else if (numberOfMonsters <= 0) {
				return Promise.reject(
					channel({
						announce: "You don't have any living monsters to send into battle. Spawn one first, or wait for your dead monsters to revive.",
					}),
				);
			}

			return this.chooseMonster({
				channel,
				monsters,
				monsterName,
				action: 'send into battle',
				reason: "you don't appear to have a monster by that name.",
			}).then((monster: BaseMonster) => {
				if (monster.cards.length < monster.cardSlots) {
					return Promise.reject(
						channel({
							announce: 'Only an evil master would send their monster into battle without enough cards.',
						}),
					);
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
					return Promise.reject(
						channel({ announce: "You don't have any monsters eligible for dismissal." }),
					) as unknown as BaseMonster;
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
			(channel({ announce: `${monster.givenName} has been dismissed from your pack.` }) as Promise<unknown>).then(
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
					return Promise.reject(
						channel({ announce: "You don't have any monsters to revive." }),
					) as unknown as BaseMonster;
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
