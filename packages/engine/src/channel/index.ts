import { BaseClass } from '../shared/baseClass.js';
import { pauseHelpers } from '../helpers/pause.js';
import { delay, mapSeries } from '../helpers/promise.js';

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
