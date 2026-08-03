import { randomUUID } from 'node:crypto';

import type { GameEvent, EventSubscriber, EventScope, EventType, EventsSinceResult } from './types.js';

const RING_BUFFER_SIZE = 200;

/**
 * Sentinel answer used to resolve a pending prompt when the user cancels the
 * flow. Consumers (connector channel wrappers, choice helpers) must translate
 * this into a `PromptCancelledError` so it never leaks into game flows as a
 * literal answer string.
 */
export const PROMPT_CANCELLED = '__cancelled__';

/** Thrown by channel wrappers when the user cancels an interactive flow. */
export class PromptCancelledError extends Error {
	constructor(message = 'Prompt cancelled by user') {
		super(message);
		this.name = 'PromptCancelledError';
	}
}

type PublishInput = {
	type: EventType;
	scope: EventScope;
	text: string;
	payload: Record<string, unknown>;
	targetUserId?: string;
};

export class RoomEventBus {
	private subscribers = new Map<string, EventSubscriber>();
	private eventLog: GameEvent[] = [];
	private pendingPrompts = new Map<string, {
		resolve: (answer: string) => void;
		reject: (err: Error) => void;
		timer: ReturnType<typeof setTimeout>;
		userId: string;
		question: string;
		choices: string[];
		timeoutMs: number;
	}>();

	constructor(public readonly roomId: string) {}

	publish(event: PublishInput): GameEvent {
		const fullEvent: GameEvent = {
			...event,
			id: `${Date.now()}-${randomUUID().slice(0, 8)}`,
			roomId: this.roomId,
			timestamp: Date.now(),
		};

		this.eventLog.push(fullEvent);
		if (this.eventLog.length > RING_BUFFER_SIZE) {
			this.eventLog.shift();
		}

		for (const subscriber of this.subscribers.values()) {
			if (
				fullEvent.scope === 'public' ||
				subscriber.userId === fullEvent.targetUserId
			) {
				try {
					subscriber.deliver(fullEvent);
				} catch {
					// subscriber errors must not crash the engine
				}
			}
		}

		return fullEvent;
	}

	subscribe(id: string, subscriber: EventSubscriber): () => void {
		this.subscribers.set(id, subscriber);
		return () => this.unsubscribe(id);
	}

	unsubscribe(id: string): void {
		this.subscribers.delete(id);
	}

	getEventsSince(eventId: string): EventsSinceResult {
		const idx = this.eventLog.findIndex(e => e.id === eventId);
		if (idx !== -1) {
			return {
				events: this.eventLog.slice(idx + 1),
				truncated: false,
				upToDate: false,
				status: 'found',
			};
		}
		// Cold buffer: the room was loaded fresh (server restart or idle eviction),
		// so memory cannot resolve the cursor. Callers must consult durable storage —
		// returning `truncated: false` here silently dropped every reconnect replay
		// across a restart, which is the single most common way to "return and see
		// nothing". `status` lets callers skip the gap warning when storage is empty,
		// since an idle room is exactly why it was evicted in the first place.
		if (this.eventLog.length === 0) {
			return { events: [], truncated: true, upToDate: false, status: 'cold' };
		}
		const parseTs = (id: string): number => {
			const dash = id.indexOf('-');
			if (dash === -1) return 0;
			const n = Number(id.slice(0, dash));
			return Number.isFinite(n) ? n : 0;
		};
		const oldest = this.eventLog[0]!;
		const newest = this.eventLog[this.eventLog.length - 1]!;
		const cursorTs = parseTs(eventId);
		if (cursorTs > parseTs(newest.id)) {
			return { events: [], truncated: false, upToDate: true, status: 'ahead' };
		}
		if (cursorTs < parseTs(oldest.id)) {
			return { events: [], truncated: true, upToDate: false, status: 'evicted' };
		}
		// Missing id whose timestamp falls inside the retained window — treat as eviction.
		return { events: [], truncated: true, upToDate: false, status: 'evicted' };
	}

	getRecentEvents(count: number): GameEvent[] {
		return this.eventLog.slice(-count);
	}

	sendPrompt(
		userId: string,
		question: string,
		choices: string[],
		timeoutMs = 120_000
	): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const requestId = randomUUID();

			const timer = setTimeout(() => {
				this.pendingPrompts.delete(requestId);
				this.publish({
					type: 'prompt.timeout',
					scope: 'private',
					targetUserId: userId,
					text: 'The game stopped waiting for your answer. Try the command again.',
					payload: { requestId },
				});
				reject(new Error(`Prompt timed out after ${timeoutMs}ms`));
			}, timeoutMs);

			this.pendingPrompts.set(requestId, {
				resolve,
				reject,
				timer,
				userId,
				question,
				choices,
				timeoutMs,
			});

			this.publish({
				type: 'prompt.request',
				scope: 'private',
				targetUserId: userId,
				text: question,
				payload: { requestId, question, choices, timeoutSeconds: Math.round(timeoutMs / 1000) },
			});
		});
	}

	getPendingPromptForUser(userId: string): {
		requestId: string;
		question: string;
		choices: string[];
		timeoutSeconds: number;
	} | null {
		for (const [requestId, pending] of this.pendingPrompts) {
			if (pending.userId === userId) {
				return {
					requestId,
					question: pending.question,
					choices: pending.choices,
					timeoutSeconds: Math.round(pending.timeoutMs / 1000),
				};
			}
		}
		return null;
	}

	cancelAllUserPrompts(userId: string): void {
		for (const [requestId, pending] of this.pendingPrompts) {
			if (pending.userId === userId) {
				clearTimeout(pending.timer);
				this.pendingPrompts.delete(requestId);
				this.publish({
					type: 'prompt.cancel',
					scope: 'private',
					targetUserId: userId,
					text: 'Action cancelled.',
					payload: { requestId },
				});
				pending.resolve(PROMPT_CANCELLED);
			}
		}
	}

	cancelPrompt(requestId: string, callerId?: string): void {
		const pending = this.pendingPrompts.get(requestId);
		if (pending) {
			if (callerId && pending.userId !== callerId) return;
			clearTimeout(pending.timer);
			this.pendingPrompts.delete(requestId);
			this.publish({
				type: 'prompt.cancel',
				scope: 'private',
				targetUserId: pending.userId,
				text: 'Action cancelled.',
				payload: { requestId },
			});
			pending.resolve(PROMPT_CANCELLED);
		}
	}

	respondToPrompt(requestId: string, answer: string, callerId?: string): boolean {
		// Clients must call cancelPrompt to cancel — never resolve with the
		// sentinel as a literal answer (it would leak into game flows).
		if (answer === PROMPT_CANCELLED) return false;
		const pending = this.pendingPrompts.get(requestId);
		if (!pending) return false;
		if (callerId && pending.userId !== callerId) return false;
		clearTimeout(pending.timer);
		this.pendingPrompts.delete(requestId);
		pending.resolve(answer);
		return true;
	}
}
