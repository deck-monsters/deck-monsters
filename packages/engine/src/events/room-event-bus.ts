import { randomUUID } from 'node:crypto';

import type { GameEvent, EventSubscriber, EventScope, EventType } from './types.js';

// TODO(ordering): When a client reconnects with a lastEventId that has already
// been evicted from this buffer, getEventsSince() returns [] with no signal
// that history was truncated.  The client silently presents an incomplete
// replay.  Fix: return a synthetic gap event (or throw a typed error) when
// lastEventId is not found, so clients can show "you missed some events".
const RING_BUFFER_SIZE = 200;

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

	getEventsSince(eventId: string): GameEvent[] {
		const idx = this.eventLog.findIndex(e => e.id === eventId);
		return idx === -1 ? [] : this.eventLog.slice(idx + 1);
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
				pending.resolve('__cancelled__');
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
			pending.resolve('__cancelled__');
		}
	}

	respondToPrompt(requestId: string, answer: string, callerId?: string): boolean {
		const pending = this.pendingPrompts.get(requestId);
		if (!pending) return false;
		if (callerId && pending.userId !== callerId) return false;
		clearTimeout(pending.timer);
		this.pendingPrompts.delete(requestId);
		pending.resolve(answer);
		return true;
	}

	hasPendingPrompt(requestId: string): boolean {
		return this.pendingPrompts.has(requestId);
	}
}
