import { random, sample } from '../helpers/random.js';
import { startCase } from '../helpers/start-case.js';
import { BaseClass } from '../shared/baseClass.js';
import { capitalize } from '../helpers/capitalize.js';
import { describeLevels, getLevel } from '../helpers/levels.js';
import { getAttributeChoices } from '../helpers/choices.js';
import { itemCard } from '../helpers/card.js';
import { MELEE } from '../constants/card-classes.js';
import { eachSeries } from '../helpers/promise.js';
import { STARTING_XP } from '../helpers/experience.js';
import PRONOUNS from '../helpers/pronouns.js';
import names from '../helpers/names.js';

import {
	AC_VARIANCE,
	BASE_AC,
	BASE_DEX,
	BASE_HP,
	BASE_INT,
	BASE_STR,
	HP_VARIANCE,
	MAX_BOOSTS,
	MAX_PROP_MODIFICATIONS
} from '../constants/stats.js';
import { TIME_TO_HEAL_MS, TIME_TO_RESURRECT_MS } from '../constants/timing.js';

// These helpers will exist when items are generated
import type { sortItemsAlphabetically as SortItemsFn } from '../items/helpers/sort.js';
import type { getItemCounts as GetItemCountsFn } from '../items/helpers/counts.js';
import type { default as getUniqueItemsFn } from '../items/helpers/unique-items.js';
import type { default as isMatchingItemFn } from '../items/helpers/is-matching.js';

// Runtime imports using dynamic require-style pattern for items helpers
// (these modules will be available at runtime even if TS doesn't resolve them yet)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sortItemsAlphabetically: typeof SortItemsFn = (items: any[]) => items;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _getItemCounts: typeof GetItemCountsFn = (items: any[]) => ({} as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _getUniqueItems: typeof getUniqueItemsFn = (items: any[]) => items;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _isMatchingItem: typeof isMatchingItemFn = () => false;

// Lazy-load items helpers to avoid circular dependency / ordering issues
const getItemsHelpers = async () => {
	const [sort, counts, unique, matching] = await Promise.all([
		import('../items/helpers/sort.js'),
		import('../items/helpers/counts.js'),
		import('../items/helpers/unique-items.js'),
		import('../items/helpers/is-matching.js')
	]);
	_sortItemsAlphabetically = sort.sortItemsAlphabetically;
	_getItemCounts = counts.getItemCounts;
	_getUniqueItems = unique.default ?? (unique as any).getUniqueItems ?? unique;
	_isMatchingItem = matching.default ?? (matching as any).isMatchingItem ?? matching;
};

// Kick off loading immediately (non-blocking)
getItemsHelpers().catch(() => {
	// Items helpers may not exist yet during generation; stubs remain in place
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CardInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ItemInstance = any;

export interface BattleRecord {
	wins: number;
	losses: number;
	total: number;
}

export interface HitLogEntry {
	assailant: BaseCreature | undefined;
	damage: number;
	card: CardInstance | undefined;
	when: number;
}

export interface EncounterModifiers {
	[key: string]: unknown;
	hitLog?: HitLogEntry[];
	ac?: number;
}

export interface Encounter {
	ring?: unknown;
	modifiers?: EncounterModifiers;
	effects?: unknown[];
	fled?: boolean;
	round?: number;
	killedBy?: BaseCreature;
	killedCreatures?: BaseCreature[];
}

export interface PronounSet {
	he: string;
	him: string;
	his: string;
}

export interface ChannelManager {
	queueMessage: (opts: { announce: string; channel: unknown; channelName: string }) => Promise<void> | void;
	sendMessages: () => Promise<void> | void;
}

export interface ChannelWithManager {
	channelManager: ChannelManager;
	channelName: string;
	(message: ChannelMessage): Promise<unknown> | unknown;
}

export interface ChannelMessage {
	announce?: string;
	question?: string;
	choices?: string[] | Record<string, unknown>;
	delay?: number | string;
	[key: string]: unknown;
}

export type ChannelFn = ((message: ChannelMessage) => Promise<unknown> | unknown) & Partial<ChannelWithManager>;

export interface CreatureOptions {
	name?: string;
	icon?: string;
	xp?: number;
	hp?: number;
	ac?: number;
	str?: number;
	dex?: number;
	int?: number;
	gender?: string;
	cards?: CardInstance[];
	items?: ItemInstance[];
	coins?: number;
	team?: string | undefined;
	targetingStrategy?: string | undefined;
	acVariance?: number;
	hpVariance?: number;
	battles?: BattleRecord;
	modifiers?: Record<string, unknown>;
	respawnTimeoutBegan?: number;
	isBoss?: boolean;
	description?: string;
	dexModifier?: number;
	strModifier?: number;
	intModifier?: number;
	/** Reserved for future item/equipment effects that grant bonus attack dice. */
	bonusAttackDice?: string;
	/** Reserved for future item/equipment effects that grant bonus damage dice. */
	bonusDamageDice?: string;
	/** Reserved for future item/equipment effects that grant bonus INT dice. */
	bonusIntDice?: string;
	[key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ITEM_SLOTS = 12;

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

class BaseCreature extends BaseClass<CreatureOptions> {
	declare inEncounter: boolean;
	declare encounter: Encounter | undefined;
	declare respawnTimeout: ReturnType<typeof setTimeout> | undefined;
	declare respawnTimeoutLength: number | undefined;
	declare healingInterval: ReturnType<typeof setInterval>;

	// Static properties set on subclasses
	static eventPrefix = 'creature';
	static class?: string;
	static creatureType?: string;
	static acVariance?: number;
	static hpVariance?: number;
	static defaults?: Record<string, unknown>;

	constructor ({
		acVariance = random(0, AC_VARIANCE),
		hpVariance = random(0, HP_VARIANCE),
		gender = sample(Object.keys(PRONOUNS)),
		xp = 0,
		...options
	}: CreatureOptions = {}) {
		super({ acVariance, hpVariance, gender, xp, ...options } as CreatureOptions);

		if (this.name === BaseCreature.name) {
			throw new Error('The BaseCreature should not be instantiated directly!');
		}

		this.healingInterval = setInterval(() => {
			if (this.hp < this.maxHp && !this.inEncounter && !this.dead) this.heal(1);
		}, TIME_TO_HEAL_MS);

		if (this.respawnTimeoutBegan) {
			this.respawn();
		}
	}

	// ---------------------------------------------------------------------------
	// Identity
	// ---------------------------------------------------------------------------

	get class (): string | undefined {
		return (this.constructor as typeof BaseCreature).class;
	}

	get creatureType (): string | undefined {
		return (this.constructor as typeof BaseCreature).creatureType;
	}

	get icon (): string | undefined {
		return this.options.icon;
	}

	get givenName (): string {
		if (!this.options.name) {
			this.setOptions({
				name: names(this.creatureType ?? '', this.gender ?? '')
			});
		}

		return startCase(this.options.name);
	}

	get identity (): string {
		return `${this.icon} ${this.givenName}`;
	}

	get identityWithHp (): string {
		return `${this.identity} (${this.hp} hp)`;
	}

	get stats (): string {
		return `Type: ${this.creatureType}
Class: ${this.class}${
	!this.team ? '' :
		`
Team: ${this.team}`
}
Level: ${this.level || this.displayLevel} | XP: ${this.xp}`;
	}

	get rankings (): string {
		return `Battles fought: ${this.battles.total}
Battles won: ${this.battles.wins}`;
	}

	get individualDescription (): string | undefined {
		return this.options.description as string | undefined ?? (this as unknown as Record<string, unknown>).description as string | undefined;
	}

	get gender (): string | undefined {
		return this.options.gender;
	}

	get isBoss (): boolean | undefined {
		return this.options.isBoss;
	}

	get pronouns (): PronounSet {
		return (PRONOUNS as Record<string, PronounSet>)[this.options.gender ?? ''];
	}

	// ---------------------------------------------------------------------------
	// Team / targeting
	// ---------------------------------------------------------------------------

	get team (): string | undefined {
		return this.options.team ?? undefined;
	}

	set team (team: string | undefined) {
		this.setOptions({ team });
	}

	get targetingStrategy (): string | undefined {
		return this.options.targetingStrategy ?? undefined;
	}

	set targetingStrategy (targetingStrategy: string | undefined) {
		this.setOptions({ targetingStrategy });
	}

	// ---------------------------------------------------------------------------
	// Stats
	// ---------------------------------------------------------------------------

	get acVariance (): number {
		return (this.options.acVariance ?? 0) + ((this.constructor as typeof BaseCreature).acVariance ?? 0);
	}

	get hpVariance (): number {
		return (this.options.hpVariance ?? 0) + ((this.constructor as typeof BaseCreature).hpVariance ?? 0);
	}

	get maxHp (): number {
		let maxHp = BASE_HP + this.hpVariance;
		maxHp += Math.min(this.level * 3, MAX_BOOSTS.hp); // Gain 3 hp per level up to the max
		maxHp += Math.min((this.modifiers as Record<string, number>).maxHp || 0, this.getMaxModifications('hp'));

		return Math.max(maxHp, 1);
	}

	get hp (): number {
		if (this.options.hp === undefined) this.hp = this.maxHp;

		return this.options.hp as number;
	}

	set hp (hp: number) {
		this.setOptions({ hp });
	}

	get level (): number {
		return getLevel(this.xp);
	}

	get displayLevel (): string {
		return describeLevels(this.level).description;
	}

	get xp (): number {
		return this.getProp('xp');
	}

	set xp (xp: number) {
		const previousLevel = this.level;
		this.setOptions({ xp });
		const newLevel = this.level;
		if (newLevel > previousLevel) {
			this.emit('levelUp', { monster: this, level: newLevel });
		}
	}

	get ac (): number {
		return this.getProp('ac');
	}

	get dex (): number {
		return this.getProp('dex');
	}

	get str (): number {
		return this.getProp('str');
	}

	get int (): number {
		return this.getProp('int');
	}

	get dexModifier (): number {
		return this.getModifier('dex');
	}

	get strModifier (): number {
		return this.getModifier('str');
	}

	get intModifier (): number {
		return this.getModifier('int');
	}

	getMaxModifications (prop: string): number {
		switch (prop) {
			case 'hp':
				return MAX_PROP_MODIFICATIONS.hp;
			case 'ac':
				return Math.ceil(MAX_PROP_MODIFICATIONS.ac * (this.level + 1));
			case 'xp':
				// can't use level for calculation because it would cause circular reference
				return Math.max(this.getPreBattlePropValue('xp')! - MAX_PROP_MODIFICATIONS.xp, MAX_PROP_MODIFICATIONS.xp);
			case 'int':
				return Math.ceil(MAX_PROP_MODIFICATIONS.int * (this.level + 1));
			case 'str':
				return Math.ceil(MAX_PROP_MODIFICATIONS.str * (this.level + 1));
			case 'dex':
				return Math.ceil(MAX_PROP_MODIFICATIONS.dex * (this.level + 1));
			default:
				return 4;
		}
	}

	getProp (targetProp: string): number {
		let prop = this.getPreBattlePropValue(targetProp) ?? 0;
		prop += Math.min((this.encounterModifiers[targetProp] as number) || 0, this.getMaxModifications(targetProp));

		return Math.max(prop, 1);
	}

	getPreBattlePropValue (prop: string): number | undefined {
		let raw: number | undefined;

		switch (prop) {
			case 'dex':
				// dexModifier already includes level scaling (+1/level via getModifier)
				raw = BASE_DEX + this.dexModifier;
				break;
			case 'str':
				raw = BASE_STR + this.strModifier;
				break;
			case 'int':
				raw = BASE_INT + this.intModifier;
				break;
			case 'ac':
				raw = BASE_AC + this.acVariance;
				raw += Math.min(this.level, MAX_BOOSTS[prop]); // AC level bonus is not in getModifier
				break;
			case 'hp':
				raw = this.maxHp;
				break;
			case 'xp':
				raw = (this.options.xp as number) || STARTING_XP;
				break;
			default:
		}

		return raw;
	}

	getModifier (targetProp: string): number {
		const targetModifier = `${targetProp}Modifier`;
		let modifier = (this.options[targetModifier] as number) || 0;

		// Level scaling: +1 per level up to the stat cap
		modifier += Math.min(this.level, (MAX_BOOSTS as Record<string, number>)[targetProp] ?? 0);

		// Permanent modifiers set via setModifier(..., permanent=true) live in options.modifiers
		const permanentModifiers = (this.options.modifiers as Record<string, number>) || {};
		modifier += Math.min(permanentModifiers[targetProp] || 0, (MAX_BOOSTS as Record<string, number>)[targetProp] ?? 0);

		return modifier;
	}

	// ---------------------------------------------------------------------------
	// Battles
	// ---------------------------------------------------------------------------

	get battles (): BattleRecord {
		if (this.options.battles === undefined) this.battles = { wins: 0, losses: 0, total: 0 };

		return this.options.battles as BattleRecord;
	}

	set battles (battles: BattleRecord) {
		this.setOptions({ battles });
	}

	addWin (): void {
		const battles: BattleRecord = {
			wins: this.battles.wins + 1,
			losses: this.battles.losses,
			total: this.battles.total + 1
		};

		this.battles = battles;
	}

	addLoss (): void {
		const battles: BattleRecord = {
			wins: this.battles.wins,
			losses: this.battles.losses + 1,
			total: this.battles.total + 1
		};

		this.battles = battles;
	}

	addDraw (): void {
		const battles: BattleRecord = {
			wins: this.battles.wins,
			losses: this.battles.losses,
			total: this.battles.total + 1
		};

		this.battles = battles;
	}

	// ---------------------------------------------------------------------------
	// Health / death
	// ---------------------------------------------------------------------------

	get dead (): boolean {
		return this.hp <= 0;
	}

	set dead (dead: boolean) {
		if (dead !== this.dead) {
			if (dead && !this.dead) {
				this.die({ identityWithHp: 'mysterious causes' } as unknown as BaseCreature);
			} else if (!dead && this.dead) {
				this.respawn();
			}
		}
	}

	get bloodiedValue (): number {
		return Math.floor(this.maxHp / 2);
	}

	get bloodied (): boolean {
		return this.hp <= this.bloodiedValue;
	}

	set bloodied (_hp: number) {
		this.setOptions({ hp: this.bloodiedValue });
	}

	get destroyed (): boolean {
		return this.hp < -this.bloodiedValue;
	}

	hit (damage = 0, assailant?: BaseCreature, card?: CardInstance): boolean {
		const hitLog: HitLogEntry[] = (this.encounterModifiers.hitLog as HitLogEntry[]) || [];
		hitLog.unshift({
			assailant,
			damage,
			card,
			when: Date.now()
		});
		this.encounterModifiers.hitLog = hitLog;

		const isMelee = card && typeof card.isCardClass === 'function' && card.isCardClass(MELEE);

		if (isMelee && (this.encounterModifiers.ac as number) >= damage) {
			(this.encounterModifiers as Record<string, unknown>).ac = (this.encounterModifiers.ac as number) - damage;

			this.emit('narration', {
				narration: `${this.givenName} was braced for a hit, and was able to absorb ${damage} damage. ${capitalize(this.pronouns.his)} ac boost is now ${this.encounterModifiers.ac}.`
			});
		} else {
			let adjustedDamage = damage;

			if (isMelee && (this.encounterModifiers.ac as number) > 0) {
				adjustedDamage -= this.encounterModifiers.ac as number;
				this.emit('narration', {
					narration: `${this.givenName} was braced for a hit, and was able to absorb ${this.encounterModifiers.ac} damage. ${capitalize(this.pronouns.his)} ac boost is now 0.`
				});
				(this.encounterModifiers as Record<string, unknown>).ac = 0;
			}

			const newHP = this.hp - adjustedDamage;
			const originalHP = this.hp;

			this.hp = newHP;

			this.emit('hit', {
				assailant,
				card,
				damage: adjustedDamage,
				newHP,
				prevHp: originalHP
			});

			if (originalHP > 0 && this.hp <= 0) {
				return this.die(assailant);
			}
		}

		return !this.dead;
	}

	heal (amount = 0): boolean {
		const hp = this.hp + amount;
		const originalHP = this.hp;

		if (hp <= 0) {
			this.hp = 0;
		} else if (hp > this.maxHp) {
			this.hp = this.maxHp;
		} else {
			this.hp = hp;
		}

		this.emit('heal', {
			amount,
			hp,
			prevHp: originalHP
		});

		if (hp <= 0) {
			return this.die(this);
		}

		return true;
	}

	die (assailant?: BaseCreature): boolean {
		if (this.hp > 0) {
			this.hp = 0;
		}

		if (assailant instanceof BaseCreature) {
			if (!this.killedBy) { // You can only be killed by one monster
				if (assailant !== this) assailant.killed = this;
				this.killedBy = assailant;

				this.emit('die', {
					destroyed: this.destroyed,
					assailant
				});
			}
		}

		return false;
	}

	// ---------------------------------------------------------------------------
	// Respawn
	// ---------------------------------------------------------------------------

	get respawnTimeoutBegan (): number {
		return (this.options.respawnTimeoutBegan as number) || 0;
	}

	set respawnTimeoutBegan (respawnTimeoutBegan: number) {
		this.setOptions({ respawnTimeoutBegan });
	}

	respawn (immediate?: boolean): number {
		const now = Date.now();
		const timeoutLength = immediate ? 0 : this.level * TIME_TO_RESURRECT_MS;

		if (immediate || !this.respawnTimeout) {
			const creature = this;

			this.respawnTimeoutBegan = this.respawnTimeoutBegan || now;
			this.respawnTimeoutLength = Math.max((this.respawnTimeoutBegan + timeoutLength) - now, 0);

			this.respawnTimeout = setTimeout(() => {
				creature.hp = Math.max(1, creature.hp);
				creature.respawnTimeout = undefined;
				creature.respawnTimeoutBegan = undefined as unknown as number;

				creature.emit('respawn');
			}, timeoutLength);
		}

		return this.respawnTimeoutBegan + timeoutLength;
	}

	// ---------------------------------------------------------------------------
	// Encounter
	// ---------------------------------------------------------------------------

	startEncounter (ring: unknown): void {
		this.inEncounter = true;
		this.encounter = { ring };
	}

	endEncounter (): Encounter {
		const { encounter = {} } = this;

		this.inEncounter = false;
		delete this.encounter;

		return encounter as Encounter;
	}

	get encounterModifiers (): EncounterModifiers {
		if (!this.encounter) this.encounter = {};
		if (!this.encounter.modifiers) this.encounter.modifiers = {};

		return this.encounter.modifiers as EncounterModifiers;
	}

	set encounterModifiers (modifiers: EncounterModifiers) {
		this.encounter = {
			...this.encounter,
			modifiers
		};
	}

	get encounterEffects (): unknown[] {
		return (this.encounter ?? {}).effects ?? [];
	}

	set encounterEffects (effects: unknown[]) {
		this.encounter = {
			...this.encounter,
			effects
		};
	}

	get fled (): boolean {
		return !!(this.encounter ?? {}).fled;
	}

	set fled (fled: boolean) {
		this.encounter = {
			...this.encounter,
			fled
		};
	}

	get modifiers (): Record<string, unknown> {
		return {
			...this.options.modifiers,
			...this.encounterModifiers
		};
	}

	set modifiers (modifiers: Record<string, unknown>) {
		this.setOptions({ modifiers });
	}

	get round (): number {
		return (this.encounter ?? {}).round ?? 1;
	}

	set round (round: number) {
		this.encounter = {
			...this.encounter,
			round
		};
	}

	get killedBy (): BaseCreature | undefined {
		return (this.encounter ?? {}).killedBy;
	}

	set killedBy (creature: BaseCreature) {
		this.encounter = {
			...this.encounter,
			killedBy: creature
		};
	}

	get killed (): BaseCreature[] {
		return (this.encounter ?? {}).killedCreatures ?? [];
	}

	set killed (creature: BaseCreature) {
		this.encounter = {
			...this.encounter,
			killedCreatures: [...this.killed, creature]
		};
	}

	setModifier (attr: string, amount = 0, permanent = false): void {
		const prevAmount = permanent
			? (this.modifiers[attr] as number) || 0
			: (this.encounterModifiers[attr] as number) || 0;
		const prevValue = (this as unknown as Record<string, unknown>)[attr];
		const modifiers = Object.assign(
			{},
			permanent ? this.modifiers : this.encounterModifiers,
			{ [attr]: prevAmount + amount }
		);

		if (permanent) {
			this.modifiers = modifiers;
		} else {
			this.encounterModifiers = modifiers as EncounterModifiers;
		}

		this.emit('modifier', {
			amount,
			attr,
			prevAmount,
			prevValue
		});
	}

	leaveCombat (activeContestants: unknown): boolean {
		this.emit('leave', { activeContestants });
		this.fled = true;

		return false;
	}

	// ---------------------------------------------------------------------------
	// Cards
	// ---------------------------------------------------------------------------

	get cards (): CardInstance[] {
		if (!Array.isArray(this.options.cards)) this.cards = [];

		return this.options.cards as CardInstance[];
	}

	set cards (cards: CardInstance[]) {
		this.setOptions({ cards });
	}

	// ---------------------------------------------------------------------------
	// Coins
	// ---------------------------------------------------------------------------

	get coins (): number {
		return (this.options.coins as number) || 0;
	}

	set coins (coins: number) {
		this.setOptions({ coins });
	}

	// ---------------------------------------------------------------------------
	// Items
	// ---------------------------------------------------------------------------

	get itemSlots (): number {
		return DEFAULT_ITEM_SLOTS;
	}

	get items (): ItemInstance[] {
		if (!Array.isArray(this.options.items)) this.items = [];

		return this.options.items as ItemInstance[];
	}

	set items (items: ItemInstance[]) {
		this.setOptions({ items });
	}

	canHold (_itemOrCard?: CardInstance | ItemInstance): boolean {
		return false;
	}

	canHoldCard (card: CardInstance): boolean {
		return this.canHold(card);
	}

	canHoldItem (item: ItemInstance): boolean {
		return this.canHold(item);
	}

	canUseItem (item: ItemInstance): boolean {
		return this.canHoldItem(item);
	}

	addItem (item: ItemInstance): void {
		this.items = _sortItemsAlphabetically([...this.items, item]);

		if (item.onAdded) {
			item.onAdded(this);
		}

		item.emit('added', { creature: this });
		this.emit('itemAdded', { item });
	}

	removeItem (itemToRemove: ItemInstance): ItemInstance | undefined {
		const itemIndex = this.items.findIndex((item: ItemInstance) => _isMatchingItem(item, itemToRemove));

		if (itemIndex >= 0) {
			const foundItem = this.items.splice(itemIndex, 1)[0];

			if (foundItem.onRemoved) {
				foundItem.onRemoved(this);
			}

			foundItem.emit('removed', { creature: this });
			this.emit('itemRemoved', { item: foundItem });

			return foundItem;
		}

		return undefined;
	}

	giveItem (itemToGive: ItemInstance, recipient: BaseCreature): void {
		const item = this.removeItem(itemToGive);

		if (item) {
			recipient.addItem(item);
			this.emit('itemGiven', { item, recipient });
		}
	}

	useItem ({ channel, channelName, character = this as unknown as BaseCreature, item, monster }: {
		channel: ChannelFn;
		channelName?: string;
		character?: BaseCreature;
		item: ItemInstance;
		monster?: BaseCreature;
	}): Promise<unknown> {
		return Promise.resolve()
			.then(() => {
				if (monster && monster.inEncounter && !monster.items.find((potentialItem: ItemInstance) => _isMatchingItem(potentialItem, item))) {
					return Promise.reject(channel({
						announce: `${monster.givenName} doesn't seem to be holding that item.`
					}));
				}

				return item.use({ channel, channelName, character, monster });
			});
	}

	lookAtItems (channel: ChannelFn, items: ItemInstance[] = this.items): Promise<void> {
		if (items.length < 1) {
			return Promise.reject();
		}

		const sortedItems = _sortItemsAlphabetically(items);
		const channelWithMgr = channel as unknown as ChannelWithManager;
		const { channelManager, channelName } = channelWithMgr;

		return Promise.resolve()
			.then(() => eachSeries(_getUniqueItems(sortedItems), (item: ItemInstance) => channelManager.queueMessage({
				announce: itemCard(item, true),
				channel,
				channelName
			})))
			.then(() => channelManager.queueMessage({
				announce: Object.entries(_getItemCounts(sortedItems) as Record<string, number>).reduce(
					(counts: string, [card, count]: [string, number]) => `${counts}${card} (${count})\n`,
					''
				),
				channel,
				channelName
			}))
			.then(() => channelManager.sendMessages());
	}

	// ---------------------------------------------------------------------------
	// Edit
	// ---------------------------------------------------------------------------

	editSelf (channel: ChannelFn): Promise<unknown> {
		const allowedKeys = ['givenName', 'icon'] as const;
		type AllowedKey = typeof allowedKeys[number];

		return Promise.resolve()
			.then(() => channel({
				question:
`Which field would you like to update?

1) Name (currently: ${this.givenName})
2) Icon/color (currently: ${this.icon})`,
				choices: ['1', '2']
			}))
			.then((answer: unknown) => {
				const key: AllowedKey = Number(answer) === 1 ? 'givenName' : 'icon';
				const current = this.options[key];
				return (channel({
					question: `The current value of ${key} is ${JSON.stringify(current)}. What would you like the new value to be?`
				}) as Promise<string>).then((strVal: string) => ({ key, oldVal: current, newVal: strVal.trim() }));
			})
			.then(({ key, oldVal, newVal }: { key: AllowedKey; oldVal: unknown; newVal: string }) =>
				(channel({
					question: `Update ${key} from ${JSON.stringify(oldVal)} to ${JSON.stringify(newVal)}? (yes/no)`
				}) as Promise<string>).then((answer = '') => {
					if (answer.toLowerCase() === 'yes') {
						this.setOptions({ [key]: newVal });
						return channel({ announce: 'Change saved.' });
					}
					return channel({ announce: 'Change reverted.' });
				})
			);
	}

	edit (channel: ChannelFn): Promise<unknown> {
		return Promise
			.resolve()
			.then(() => (this as unknown as Record<string, unknown>).look && (this as unknown as { look: (ch: ChannelFn) => unknown }).look(channel))
			.then(() => channel({
				question:
`Which attribute would you like to edit?

${getAttributeChoices(this.options)}`,
				choices: Object.keys(Object.keys(this.options))
			}))
			.then(index => Object.keys(this.options)[index as unknown as number])
			.then(key => (channel({
				question:
`The current value of ${key} is ${JSON.stringify(this.options[key])}. What would you like the new value of ${key} to be?`
			}) as Promise<string>)
				.then((strVal: string) => {
					const oldVal = this.options[key];
					let newVal: unknown;

					try {
						newVal = JSON.parse(strVal);
					} catch (ex) {
						newVal = +strVal;

						if (isNaN(newVal as number)) {
							newVal = strVal;
						}
					}

					return { key, oldVal, newVal };
				}))
			.then(({ key, oldVal, newVal }: { key: string; oldVal: unknown; newVal: unknown }) => (channel({
				question:
`The value of ${key} has been updated from ${JSON.stringify(oldVal)} to ${JSON.stringify(newVal)}. Would you like to keep this change? (yes/no)`
			}) as Promise<string>)
				.then((answer = '') => {
					if (answer.toLowerCase() === 'yes') {
						this.setOptions({ [key]: newVal });

						return channel({ announce: 'Change saved.' });
					}

					return channel({ announce: 'Change reverted.' });
				}));
	}
}

BaseCreature.eventPrefix = 'creature';

export { BaseCreature };
export default BaseCreature;
