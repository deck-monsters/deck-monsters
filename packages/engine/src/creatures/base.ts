import { random, sample } from '../helpers/random.js';
import { startCase } from '../helpers/start-case.js';
import { BaseClass } from '../shared/baseClass.js';
import { describeLevels, getLevel } from '../helpers/levels.js';
import { getAttributeChoices } from '../helpers/choices.js';
import PRONOUNS from '../helpers/pronouns.js';
import names from '../helpers/names.js';

import {
	AC_VARIANCE,
	HP_VARIANCE,
} from '../constants/stats.js';
import { TIME_TO_HEAL_MS } from '../constants/timing.js';

import { getMaxModifications, getPreBattlePropValue, getProp, getModifier } from './stats.js';
import { startEncounter, endEncounter, getEncounterModifiers, setEncounterModifiers, getEncounterEffects, setEncounterEffects, getFled, setFled, getRound, setRound, getKilledBy, setKilledBy, getKilled, appendKilled, setModifier, leaveCombat } from './encounter.js';
import { hit, heal, die, respawn } from './health.js';
import { addItem, removeItem, giveItem, useItem, lookAtItems } from './items.js';

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
			this.setOptions({ name: names(this.creatureType ?? '', this.gender ?? '') });
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
	// Stats — delegated to creatures/stats.ts
	// ---------------------------------------------------------------------------

	get acVariance (): number {
		return (this.options.acVariance ?? 0) + ((this.constructor as typeof BaseCreature).acVariance ?? 0);
	}

	get hpVariance (): number {
		return (this.options.hpVariance ?? 0) + ((this.constructor as typeof BaseCreature).hpVariance ?? 0);
	}

	get maxHp (): number {
		return Math.max(getPreBattlePropValue(this, 'hp') ?? 1, 1);
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

	get ac (): number { return this.getProp('ac'); }
	get dex (): number { return this.getProp('dex'); }
	get str (): number { return this.getProp('str'); }
	get int (): number { return this.getProp('int'); }

	get dexModifier (): number { return this.getModifier('dex'); }
	get strModifier (): number { return this.getModifier('str'); }
	get intModifier (): number { return this.getModifier('int'); }

	getMaxModifications (prop: string): number { return getMaxModifications(this, prop); }
	getProp (targetProp: string): number { return getProp(this, targetProp); }
	getPreBattlePropValue (prop: string): number | undefined { return getPreBattlePropValue(this, prop); }
	getModifier (targetProp: string): number { return getModifier(this, targetProp); }

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
		this.battles = { wins: this.battles.wins + 1, losses: this.battles.losses, total: this.battles.total + 1 };
	}

	addLoss (): void {
		this.battles = { wins: this.battles.wins, losses: this.battles.losses + 1, total: this.battles.total + 1 };
	}

	addDraw (): void {
		this.battles = { wins: this.battles.wins, losses: this.battles.losses, total: this.battles.total + 1 };
	}

	// ---------------------------------------------------------------------------
	// Health / death — delegated to creatures/health.ts
	// ---------------------------------------------------------------------------

	get dead (): boolean { return this.hp <= 0; }

	set dead (dead: boolean) {
		if (dead !== this.dead) {
			if (dead && !this.dead) {
				this.die({ identityWithHp: 'mysterious causes' } as unknown as BaseCreature);
			} else if (!dead && this.dead) {
				this.respawn();
			}
		}
	}

	get bloodiedValue (): number { return Math.floor(this.maxHp / 2); }
	get bloodied (): boolean { return this.hp <= this.bloodiedValue; }

	set bloodied (_hp: number) {
		this.setOptions({ hp: this.bloodiedValue });
	}

	get destroyed (): boolean { return this.hp < -this.bloodiedValue; }

	hit (damage = 0, assailant?: BaseCreature, card?: CardInstance): boolean { return hit(this, damage, assailant, card); }
	heal (amount = 0): boolean { return heal(this, amount); }
	die (assailant?: BaseCreature): boolean { return die(this, assailant); }
	respawn (immediate?: boolean): number { return respawn(this, immediate); }

	get respawnTimeoutBegan (): number {
		return (this.options.respawnTimeoutBegan as number) || 0;
	}

	set respawnTimeoutBegan (respawnTimeoutBegan: number) {
		this.setOptions({ respawnTimeoutBegan });
	}

	// ---------------------------------------------------------------------------
	// Encounter — delegated to creatures/encounter.ts
	// ---------------------------------------------------------------------------

	startEncounter (ring: unknown): void { startEncounter(this, ring); }
	endEncounter (): Encounter { return endEncounter(this); }

	get encounterModifiers (): EncounterModifiers { return getEncounterModifiers(this); }
	set encounterModifiers (modifiers: EncounterModifiers) { setEncounterModifiers(this, modifiers); }

	get encounterEffects (): unknown[] { return getEncounterEffects(this); }
	set encounterEffects (effects: unknown[]) { setEncounterEffects(this, effects); }

	get fled (): boolean { return getFled(this); }
	set fled (fled: boolean) { setFled(this, fled); }

	get modifiers (): Record<string, unknown> {
		return { ...this.options.modifiers, ...this.encounterModifiers };
	}

	set modifiers (modifiers: Record<string, unknown>) {
		this.setOptions({ modifiers });
	}

	get round (): number { return getRound(this); }
	set round (round: number) { setRound(this, round); }

	get killedBy (): BaseCreature | undefined { return getKilledBy(this); }
	set killedBy (creature: BaseCreature) { setKilledBy(this, creature); }

	get killed (): BaseCreature[] { return getKilled(this); }
	set killed (creature: BaseCreature) { appendKilled(this, creature); }

	setModifier (attr: string, amount = 0, permanent = false): void { setModifier(this, attr, amount, permanent); }
	leaveCombat (activeContestants: unknown): boolean { return leaveCombat(this, activeContestants); }

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

	get coins (): number { return (this.options.coins as number) || 0; }
	set coins (coins: number) { this.setOptions({ coins }); }

	// ---------------------------------------------------------------------------
	// Items — delegated to creatures/items.ts
	// ---------------------------------------------------------------------------

	get itemSlots (): number { return DEFAULT_ITEM_SLOTS; }

	get items (): ItemInstance[] {
		if (!Array.isArray(this.options.items)) this.items = [];
		return this.options.items as ItemInstance[];
	}

	set items (items: ItemInstance[]) {
		this.setOptions({ items });
	}

	canHold (_itemOrCard?: CardInstance | ItemInstance): boolean { return false; }
	canHoldCard (card: CardInstance): boolean { return this.canHold(card); }
	canHoldItem (item: ItemInstance): boolean { return this.canHold(item); }
	canUseItem (item: ItemInstance): boolean { return this.canHoldItem(item); }

	addItem (item: ItemInstance): void { addItem(this, item); }
	removeItem (itemToRemove: ItemInstance): ItemInstance | undefined { return removeItem(this, itemToRemove); }
	giveItem (itemToGive: ItemInstance, recipient: BaseCreature): void { giveItem(this, itemToGive, recipient); }

	useItem ({ channel, channelName, character = this as unknown as BaseCreature, item, monster }: {
		channel: ChannelFn;
		channelName?: string;
		character?: BaseCreature;
		item: ItemInstance;
		monster?: BaseCreature;
	}): Promise<unknown> {
		return useItem(this, { channel, channelName, character, item, monster });
	}

	lookAtItems (channel: ChannelFn, items: ItemInstance[] = this.items): Promise<void> {
		return lookAtItems(this, channel, items);
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

0) Name (currently: ${this.givenName})
1) Icon/color (currently: ${this.icon})`,
				choices: [`Name (currently: ${this.givenName})`, `Icon/color (currently: ${this.icon})`]
			}))
			.then((answer: unknown) => {
				const key: AllowedKey = Number(answer) === 0 ? 'givenName' : 'icon';
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
		const optionKeys = Object.keys(this.options);
		return Promise
			.resolve()
			.then(() => (this as unknown as Record<string, unknown>).look && (this as unknown as { look: (ch: ChannelFn) => unknown }).look(channel))
			.then(() => channel({
				question: `Which attribute would you like to edit?`,
				choices: optionKeys.map(key => `${key} (${JSON.stringify(this.options[key])})`)
			}))
			.then(index => optionKeys[index as unknown as number])
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
						if (isNaN(newVal as number)) newVal = strVal;
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
