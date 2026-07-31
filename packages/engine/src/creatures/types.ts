import type { BaseCreature } from './base.js';

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
	/** Stable id for analytics / leaderboards (persisted in game state). */
	stableId?: string;
	[key: string]: unknown;
}
