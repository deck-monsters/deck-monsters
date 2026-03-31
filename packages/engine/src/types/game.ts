import type { CharacterActions, CharacterInfo, CharacterLike } from './character.js';
import type { GameStateLike, SerializedState } from './state.js';

export interface ChannelMessage {
	announce?: string;
	question?: string;
	choices?: string[] | Record<string, unknown>;
	delay?: number;
	[key: string]: unknown;
}

export type PublicChannelFn = (message: ChannelMessage) => Promise<unknown> | unknown;

export type PrivateChannelFn = (message: ChannelMessage) => Promise<unknown> | unknown;

export type StateSaveFn = (state: SerializedState) => Promise<unknown> | unknown;

export interface GameOptions {
	log?: unknown;
	seed?: string | number;
	autosave?: boolean;
	saveIntervalMs?: number;
	adapter?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface CommandContext {
	channel?: PrivateChannelFn;
	channelName?: string;
	isAdmin?: boolean;
	isDM?: boolean;
	user?: CharacterInfo;
	[key: string]: unknown;
}

export type CommandAction = (context: CommandContext) => Promise<unknown> | unknown;

export interface GamePublicApi {
	options?: GameOptions;
	state?: GameStateLike;
	saveState?: StateSaveFn;
	getCharacter?: (info: CharacterInfo) => Promise<CharacterLike & CharacterActions> | (CharacterLike & CharacterActions);
	handleCommand?: (input: { command?: string; [key: string]: unknown }) => CommandAction | null;
	[key: string]: unknown;
}
