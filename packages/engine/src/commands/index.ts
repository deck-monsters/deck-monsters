import lookAtHandlers from './look-at.js';
import monsterHandlers from './monster.js';
import characterHandlers from './character.js';
import storeHandlers from './store.js';
import { helpHandler } from './help.js';
import { commandInputSchema } from '../schemas/command.js';

const ALIAS_REGEX = /(.+) as (.+?)\s*$/i;
const handlers: Array<(command: string) => ((options: ActionOptions) => Promise<unknown>) | null> = [];

// Handlers that don't require a character (bypass game.getCharacter).
const preCharacterHandlers: Array<{ matcher: RegExp; action: (options: ActionOptions) => Promise<unknown> }> = [];

export interface User {
	id: string;
	name: string;
	[key: string]: unknown;
}

export interface ActionOptions {
	channel: (...args: any[]) => Promise<unknown>;
	channelName: string;
	isAdmin?: boolean;
	isDM?: boolean;
	user: User;
	[key: string]: unknown;
}

export function listen(options: { command?: string; game: any } | null): ((actionOptions: ActionOptions) => Promise<unknown>) | null {
	const parsedOptions = commandInputSchema.safeParse(options || {});
	if (!parsedOptions.success) return null;

	const { game } = (parsedOptions.data as any);
	let { command = '' } = parsedOptions.data;

	const aliasCheck = command.match(ALIAS_REGEX);
	if (aliasCheck) {
		command = aliasCheck[1];
	}

	command = command.trim().toLowerCase();

	// Check pre-character handlers first (they don't need a character to exist).
	for (const { matcher, action } of preCharacterHandlers) {
		if (matcher.test(command)) {
			return (actionOptions: ActionOptions) => action(actionOptions);
		}
	}

	const action = handlers.reduce<((options: ActionOptions) => Promise<unknown>) | null>(
		(result, handler) => result || handler(command),
		null
	);

	if (action) {
		return (actionOptions: ActionOptions) =>
			Promise.resolve().then(() => {
				const {
					channel: privateChannel,
					channelName,
					isAdmin,
					user,
				} = actionOptions;

				let { id, name } = user;

				if (aliasCheck) {
					if (!isAdmin) {
						return Promise.reject(
							new Error('Aliases are a debugging feature and are only usable by admins')
						);
					}

					name = aliasCheck[2];
					id = `${id}_${name}`;
				}

				const { channelManager } = game;
				const channel = (...args: any[]) => privateChannel(...args);
				(channel as any).channelManager = channelManager;
				(channel as any).channelName = channelName;

				return game
					.getCharacter({ ...actionOptions, channel, id, name })
					.then((character: any) =>
						action({ ...actionOptions, channel, character, game })
					);
			});
	}

	return null;
}

export function registerHandler(
	matcher: RegExp | ((command: string) => RegExpMatchArray | null),
	action: (options: any) => Promise<unknown>
): void {
	const func =
		typeof matcher === 'function'
			? matcher
			: (command: string = '') => command.match(matcher as RegExp);

	const handler = (command: string) => {
		const results = func(command);

		if (results) return (options: any) => action({ results, ...options });

		return null;
	};

	handlers.push(handler);
}

export function loadHandlers(): void {
	preCharacterHandlers.push(helpHandler);
	lookAtHandlers(registerHandler);
	monsterHandlers(registerHandler);
	characterHandlers(registerHandler);
	storeHandlers(registerHandler);
}
