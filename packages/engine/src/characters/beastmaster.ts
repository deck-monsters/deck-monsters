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
import { formatRelative } from '../helpers/time.js';
import { eachSeries } from '../helpers/promise.js';
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

export const beastmasterReady = loadHelpers().catch(() => {
	// Helpers not ready yet; stubs remain in place
});

const DEFAULT_MONSTER_SLOTS = 7;

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
						question: `You have ${numberOfMonsters} monsters:\n\n${_getMonsterChoices(monsters)}\nWhich monster would you like to ${action}?`,
						choices: Object.keys(monsters),
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
	}: {
		monsterName?: string;
		ring: any;
		channel: ChannelFn;
		channelName?: string;
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
							announce: 'Only an evil master would send their monster into battle with enough cards.',
						}),
					);
				}
				return ring.addMonster({ monster, character, channel, channelName });
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
