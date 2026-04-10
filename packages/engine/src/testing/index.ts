/**
 * Test / harness utilities for driving the Game without Slack, HTTP, or a DB.
 * Mirrors production wiring (tRPC router channel → RoomEventBus) so simulations
 * exercise the same code paths as the server connector.
 */

import Game from '../game.js';
import { RoomEventBus } from '../events/index.js';
import type { GameEvent } from '../events/index.js';
import { createKeyedPromiseQueue } from '../helpers/room-engine-queue.js';

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
 * Creates a real Game instance suitable for integration tests and harness runs.
 * The no-op state store prevents the 30-second save debounce timer from
 * keeping the Node.js process alive after the run finishes.
 *
 * Pass `spawnBosses: false` (recommended for harness scripts) to avoid long-lived
 * boss spawn timers that keep the Node process from exiting.
 */
export function createTestGame(roomId = 'test-room', options: Record<string, unknown> = {}): Game {
	const game = new Game({
		spawnBosses: false,
		roomId,
		...options,
	});
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
 * 2. Awaits the action with a test channel
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

/**
 * Returns a function that mirrors production `RoomManager.runSerializedEngineWork`:
 * only one in-flight command chain per `roomId` at a time. Use in harness scenarios
 * that fire `runCommand` in parallel against one `Game`.
 */
export function createRoomCommandRunner(): (roomId: string, fn: () => Promise<unknown>) => Promise<unknown> {
	const run = createKeyedPromiseQueue();
	return (roomId: string, fn: () => Promise<unknown>) => run(roomId, fn);
}
