import type { RoomEventBus, GameEvent } from '../events/index.js';
import { PROMPT_CANCELLED } from '../events/index.js';
import type { ChannelCallback } from './index.js';

/**
 * ConnectorAdapter bridges the event bus to callback-based connectors (Slack, Discord, etc.).
 *
 * Usage:
 *   const adapter = new ConnectorAdapter(game.eventBus, publicChannel);
 *   adapter.registerUser(userId, privateChannel);
 *
 * Public events are routed to publicChannel.
 * Private events are routed to the registered per-user privateChannel.
 * PromptRequest events are delivered to the user's channel with { question, choices }.
 */
export type ConnectorAdapterChannelErrorHandler = (err: unknown) => void;

export class ConnectorAdapter {
	private privateChannels = new Map<string, ChannelCallback>();
	private userUnsubs = new Map<string, () => void>();

	constructor(
		private readonly eventBus: RoomEventBus,
		private readonly publicChannel: ChannelCallback,
		private readonly subscriberId = 'connector-adapter',
		private readonly onChannelError?: ConnectorAdapterChannelErrorHandler,
	) {
		eventBus.subscribe(subscriberId, {
			deliver: (event: GameEvent) => {
				if (event.scope === 'public') {
					void this.publicChannel({ announce: event.text });
				}
			},
		});
	}

	private settlePromptCancelled(requestId: string, userId: string, err?: unknown): void {
		this.eventBus.cancelPrompt(requestId, userId);
		if (err !== undefined && this.onChannelError) {
			try {
				this.onChannelError(err);
			} catch {
				// Callback failures must not prevent settlement or surface as unhandled rejections.
			}
		}
	}

	private handlePrivateEvent(userId: string, event: GameEvent): void {
		if (event.type === 'prompt.request') {
			const channel = this.privateChannels.get(userId);
			if (!channel) return;

			const { question, choices, requestId } = event.payload as {
				question: string;
				choices: string[];
				requestId: string;
			};
			void channel({ announce: '', question, choices: choices as any })
				.then((answer: unknown) => {
					if (answer === PROMPT_CANCELLED) {
						this.settlePromptCancelled(requestId, userId);
						return;
					}
					if (typeof answer === 'string') {
						this.eventBus.respondToPrompt(requestId, answer);
						return;
					}
					this.settlePromptCancelled(
						requestId,
						userId,
						new Error('Connector channel resolved with non-string answer'),
					);
				})
				.catch((err: unknown) => {
					this.settlePromptCancelled(requestId, userId, err);
				});
			return;
		}

		if (event.scope === 'private') {
			const channel = this.privateChannels.get(userId);
			if (channel) {
				void channel({ announce: event.text });
			}
		}
	}

	registerUser(userId: string, channel: ChannelCallback): void {
		this.unregisterUser(userId);
		this.privateChannels.set(userId, channel);
		const unsub = this.eventBus.subscribe(`${this.subscriberId}:${userId}`, {
			userId,
			deliver: (event: GameEvent) => {
				this.handlePrivateEvent(userId, event);
			},
		});
		this.userUnsubs.set(userId, unsub);
	}

	unregisterUser(userId: string): void {
		this.userUnsubs.get(userId)?.();
		this.userUnsubs.delete(userId);
		this.privateChannels.delete(userId);
	}

	dispose(): void {
		this.eventBus.unsubscribe(this.subscriberId);
		for (const unsub of this.userUnsubs.values()) {
			unsub();
		}
		this.userUnsubs.clear();
		this.privateChannels.clear();
	}
}
