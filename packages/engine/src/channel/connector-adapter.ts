import type { RoomEventBus, GameEvent } from '../events/index.js';
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
export class ConnectorAdapter {
	private privateChannels = new Map<string, ChannelCallback>();

	constructor(
		private readonly eventBus: RoomEventBus,
		private readonly publicChannel: ChannelCallback,
		private readonly subscriberId = 'connector-adapter'
	) {
		eventBus.subscribe(subscriberId, {
			deliver: (event: GameEvent) => {
				this.handleEvent(event);
			}
		});
	}

	private handleEvent(event: GameEvent): void {
		if (event.type === 'prompt.request') {
			if (event.targetUserId) {
				const channel = this.privateChannels.get(event.targetUserId);
				if (channel) {
					const { question, choices, requestId } = event.payload as {
						question: string;
						choices: string[];
						requestId: string;
					};
					void channel({ announce: '', question, choices: choices as any })
						.then((answer: unknown) => {
							if (typeof answer === 'string') {
								this.eventBus.respondToPrompt(requestId, answer);
							}
						})
						.catch(() => {});
				}
			}
			return;
		}

		if (event.scope === 'public') {
			void this.publicChannel({ announce: event.text });
		} else if (event.scope === 'private' && event.targetUserId) {
			const channel = this.privateChannels.get(event.targetUserId);
			if (channel) {
				void channel({ announce: event.text });
			}
		}
	}

	registerUser(userId: string, channel: ChannelCallback): void {
		this.privateChannels.set(userId, channel);
	}

	unregisterUser(userId: string): void {
		this.privateChannels.delete(userId);
	}

	dispose(): void {
		this.eventBus.unsubscribe(this.subscriberId);
		this.privateChannels.clear();
	}
}
