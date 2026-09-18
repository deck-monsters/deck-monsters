import { BaseClass } from '../shared/baseClass.js';
import { pauseHelpers } from '../helpers/pause.js';
import { delay, mapSeries } from '../helpers/promise.js';

/**
 * Prompt/answer contract (see docs/prompt-answer-contract.md for the full write-up):
 * when `question` is set together with `choices`, the connector must present each choice
 * (in order — the engine renders them 0-based, "0) Foo", via `helpers/choices.ts#getChoices`)
 * and resolve the returned promise with the user's answer.
 *
 * The answer may be EITHER the 0-based index as a string (what the web client sends) OR the
 * choice's label text, case-insensitively (what the Discord connector sends — its buttons
 * carry the label as `customId` and resolve with that verbatim). Engine code that dispatches
 * on a `choices` answer must decode it with `resolveChoiceIndex` (helpers/choices.ts) or
 * equivalent label-or-index matching, never a bare `Number(answer) === N` comparison — that
 * only recognizes one connector's answer shape and silently mis-routes (or breaks) the other.
 * `items/store/buy.ts`/`sell.ts` hand-wrote a 1-based menu with exactly that bug; see
 * docs/roadmap/10b-bugs-fixed.md #143 for what it looked like in production.
 */
export type ChannelCallback = (opts: {
	announce: string;
	question?: string;
	choices?: Record<string, unknown>;
	delay?: number;
}) => Promise<unknown>;

interface QueueItem {
	announce?: string;
	channelName: string;
	event?: { name: string; properties: unknown };
}

interface MessageBatch {
	announcements: string[];
	channelName: string;
	events: Array<{ name: string; properties: unknown }>;
	length: number;
}

const sendMessage = (
	channel: ChannelCallback | undefined,
	announce: string
): Promise<void> =>
	Promise.resolve().then(() => {
		if (channel) {
			return channel({ announce }).then(() => delay(pauseHelpers.getThrottleRate()));
		}
		return undefined;
	});

export class ChannelManager extends BaseClass {
	static eventPrefix = 'channel';

	channels: Record<string, ChannelCallback> = {};
	queue: QueueItem[] = [];
	log: (err: unknown) => void;

	constructor(
		options: Record<string, unknown> = {},
		log: (err: unknown) => void = () => {}
	) {
		super(options);

		this.log = log;
		this.channels = {};
		this.queue = [];

		const sendMessagesLoop = (): void => {
			void this.sendMessages()
				.catch(err => log(err))
				.then(() => delay(pauseHelpers.getThrottleRate() * 1.5))
				.then(() => setTimeout(() => sendMessagesLoop(), 0));
		};

		sendMessagesLoop();
	}

	addChannel({ channel, channelName }: { channel: ChannelCallback; channelName: string }): void {
		this.channels[channelName] = channel;
	}

	getChannel({ channelName }: { channelName: string }): ChannelCallback | undefined {
		return this.channels[channelName];
	}

	queueMessage({
		announce,
		channel,
		channelName = String(Date.now()),
		event,
	}: {
		announce?: string;
		channel?: ChannelCallback;
		channelName?: string;
		event?: { name: string; properties: unknown };
	}): Promise<void> {
		return Promise.resolve().then(() => {
			if (channel && !this.getChannel({ channelName })) {
				this.addChannel({ channel, channelName });
			}

			this.queue.push({ announce, channelName, event });
		});
	}

	sendMessages({ channelName }: { channelName?: string } = {}): Promise<void> {
		return Promise.resolve()
			.then(() => {
				const messagesForChannel = this.queue.filter(
					item => !channelName || item.channelName === channelName
				);
				this.queue = this.queue.filter(item => !messagesForChannel.includes(item));

				return messagesForChannel;
			})
			.then(messagesForChannel =>
				messagesForChannel.reduce<MessageBatch[]>((messages, item) => {
					let message = messages[messages.length - 1];
					const announceLength = item.announce ? item.announce.length : 0;

					if (
						!message ||
						message.channelName !== item.channelName ||
						message.length + announceLength > 3000
					) {
						message = {
							announcements: [],
							channelName: item.channelName,
							events: [],
							length: 0,
						};

						messages.push(message);
					}

					if (item.announce) message.announcements.push(item.announce);
					if (item.event) message.events.push(item.event);
					message.length += announceLength;

					return messages;
				}, [])
			)
			.then(messages =>
				mapSeries(messages, message => {
					const channel = this.channels[message.channelName];

					return sendMessage(channel, message.announcements.join('\n')).then(() => {
						message.events.forEach(event => this.emit(event.name, event.properties));
					});
				})
			)
			.then(() => undefined);
	}
}

export default ChannelManager;

export { ConnectorAdapter } from './connector-adapter.js';
