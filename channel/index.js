const Promise = require('bluebird');

const BaseClass = require('../shared/baseClass');
const pause = require('../helpers/pause');

const sendMessage = (channel, announce) => Promise.resolve()
	.then(() => channel && channel({ announce })
		.then(() => Promise.delay(pause.getThrottleRate())));

class ChannelManager extends BaseClass {
	constructor (options, log) {
		super(options);

		this.channels = {};
		this.queue = [];
		this.log = log;

		const sendMessagesLoop = () => this
			.sendMessages()
			.catch(err => log(err))
			.then(() => Promise.delay(pause.getThrottleRate() * 1.5))
			.then(() => setTimeout(() => sendMessagesLoop(), 0));

		sendMessagesLoop();
	}

	addChannel ({ channel, channelName }) {
		this.channels[channelName] = channel;
		return this.channels[channelName];
	}

	getChannel ({ channelName }) {
		return this.channels[channelName];
	}

	queueMessage ({
		announce, channel, channelName = Date.now(), event
	}) {
		return Promise
			.resolve()
			.then(() => {
				if (channel && !this.getChannel(channelName)) {
					this.addChannel({ channel, channelName });
				}

				this.queue.push({ announce, channelName, event });
			});
	}

	// Normally send messages for all channels when called, but allow this to be overridden as needed
	sendMessages ({ channelName } = {}) {
		return Promise
			.resolve()
			.then(() => {
				const messagesForChannel = this.queue.filter(item => !channelName || item.channelName === channelName);
				this.queue = this.queue.filter(item => !messagesForChannel.includes(item));

				return messagesForChannel;
			})
			.then(messagesForChannel => messagesForChannel.reduce((messages, item) => {
				let message = messages[messages.length - 1];
				const announceLength = item.announce ? item.announce.length : 0;

				if (!message || message.channelName !== item.channelName || (message.length + announceLength) > 3000) {
					message = {
						announcements: [],
						channelName: item.channelName,
						events: [],
						length: 0
					};

					messages.push(message);
				}

				if (item.announce) message.announcements.push(item.announce);
				if (item.event) message.events.push(item.event);
				message.length += announceLength;

				return messages;
			}, []))
			.then(messages => Promise.mapSeries(messages, (message) => {
				const channel = this.channels[message.channelName];

				return sendMessage(channel, message.announcements.join('\n'))
					.then(() => {
						message.events.forEach(event => this.emit(event.name, event.properties));
					});
			}));
	}
}

ChannelManager.eventPrefix = 'channel';

module.exports = ChannelManager;
