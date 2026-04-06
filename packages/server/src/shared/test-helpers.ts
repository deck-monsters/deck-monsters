/**
 * Integration test utilities for exercising the full command → channel → prompt
 * → respond cycle against a real Game engine instance.
 *
 * These helpers mirror the wiring in packages/server/src/trpc/router.ts so that
 * integration tests exercise exactly the same code paths as production, without
 * needing an HTTP server or database.
 */

import { Game, RoomEventBus } from '@deck-monsters/engine';
import type { GameEvent } from '@deck-monsters/engine';

// ---------------------------------------------------------------------------
// No-op state store — prevents the 30s debounce timer from firing in tests
// ---------------------------------------------------------------------------

export const noopStateStore = {
	save: async (_roomId: string, _state: string): Promise<void> => undefined,
	load: async (_roomId: string): Promise<string | null> => null,
};

// ---------------------------------------------------------------------------
// createTestGame
// ---------------------------------------------------------------------------

/**
 * Creates a real Game instance suitable for integration tests.
 * The no-op state store prevents the 30-second save debounce timer from
 * keeping the Node.js process alive after the test finishes.
 */
export function createTestGame(roomId = 'test-room'): Game {
	const game = new Game({ roomId });
	game.stateStore = noopStateStore;
	return game;
}

// ---------------------------------------------------------------------------
// createTestChannel
// ---------------------------------------------------------------------------

export interface ChannelMessage {
	announce?: string;
	question?: string;
	choices?: string[] | Record<string, unknown>;
}

export interface TestChannel {
	/** The channel function to pass to action() — mirrors the tRPC router callback */
	fn: (msg: ChannelMessage) => Promise<unknown>;
	/** All announce messages emitted during the flow */
	announces: string[];
}

/**
 * Creates a channel callback that mirrors the tRPC router's channel construction:
 * - Questions → eventBus.sendPrompt (waits for respondToPrompt)
 * - Announces → eventBus.publish as a private 'announce' event
 *
 * Also accumulates all announce text in `announces` for assertion.
 */
export function createTestChannel(eventBus: RoomEventBus, userId: string): TestChannel {
	const announces: string[] = [];

	const fn = async (msg: ChannelMessage): Promise<unknown> => {
		const { announce, question, choices } = msg;

		if (question) {
			const choiceKeys = choices
				? Array.isArray(choices)
					? choices
					: Object.keys(choices)
				: [];
			return eventBus.sendPrompt(userId, question, choiceKeys);
		}

		if (announce) {
			announces.push(announce);
			eventBus.publish({
				type: 'announce',
				scope: 'private',
				targetUserId: userId,
				text: announce,
				payload: {},
			});
		}

		return undefined;
	};

	return { fn, announces };
}

// ---------------------------------------------------------------------------
// createAutoResponder
// ---------------------------------------------------------------------------

export interface AutoResponder {
	/** All events delivered to this subscriber */
	events: GameEvent[];
	/** Number of prompts that have been answered */
	promptsAnswered: number;
	/** Unsubscribe from the event bus */
	unsubscribe: () => void;
}

/**
 * Subscribes to the event bus and automatically answers prompt.request events
 * using the provided scripted answers in order.  When the scripted answers are
 * exhausted the responder falls back to '0' (the first choice / empty string).
 *
 * The response is dispatched via setImmediate so that the sendPrompt promise
 * resolves in the next iteration of the event loop — after the synchronous
 * deliver() callback returns — which is required for the Promise chain in the
 * engine to proceed correctly.
 */
export function createAutoResponder(
	eventBus: RoomEventBus,
	userId: string,
	answers: string[],
): AutoResponder {
	const events: GameEvent[] = [];
	let idx = 0;
	let promptsAnswered = 0;

	const unsubscribe = eventBus.subscribe(`auto-responder:${userId}:${Date.now()}`, {
		userId,
		deliver(event: GameEvent) {
			events.push(event);

			if (event.type !== 'prompt.request') return;
			if (event.targetUserId !== userId) return;

			const { requestId } = event.payload as { requestId: string };
			const answer = idx < answers.length ? answers[idx++]! : '0';
			promptsAnswered++;

			// Defer the response so the sendPrompt promise resolves on the next
			// iteration — the synchronous deliver() call must return first.
			setImmediate(() => {
				eventBus.respondToPrompt(requestId, answer);
			});
		},
	});

	return { events, get promptsAnswered() { return promptsAnswered; }, unsubscribe };
}

// ---------------------------------------------------------------------------
// runCommand
// ---------------------------------------------------------------------------

/**
 * Thin wrapper that replicates the tRPC router's game.command flow:
 * 1. Calls game.handleCommand to get the action
 * 2. Fires the action with a test channel
 * Returns the test channel (for assertions on announcements) and a promise
 * that resolves when the action completes.
 */
export async function runCommand(
	game: Game,
	{
		command,
		userId,
		userName = 'Tester',
		channelName = 'test',
		isDM = true,
		isAdmin = false,
	}: {
		command: string;
		userId: string;
		userName?: string;
		channelName?: string;
		isDM?: boolean;
		isAdmin?: boolean;
	},
): Promise<{ channel: TestChannel; result: unknown }> {
	const eventBus = game.eventBus;
	const channel = createTestChannel(eventBus, userId);

	const action = game.handleCommand({ command, game });
	if (!action) {
		throw new Error(`Command not recognized: "${command}"`);
	}

	const result = await action({
		channel: channel.fn as (...args: unknown[]) => Promise<unknown>,
		channelName,
		isAdmin,
		isDM,
		user: { id: userId, name: userName },
	});

	return { channel, result };
}
