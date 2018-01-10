const Promise = require('bluebird');

const BaseClass = require('../baseClass');
const pause = require('../helpers/pause');

const THROTTLE_RATE = 5000;

const sendMessage = (channel, announce) => new Promise((resolve) => {
	pause.setTimeout(() => {
		resolve(channel ? channel({ announce }) : Promise.resolve());
	}, THROTTLE_RATE);
});

class ChannelManager extends BaseClass {
	constructor (options, log) {
		super(options);

		this.channels = {};
		this.queue = [];
		this.log = log;

		const sendMessagesLoop = () => new Promise((resolve) => {
			const timeout = () => pause.setTimeout(() => resolve(), THROTTLE_RATE * 1.5);

			this.sendMessages()
				.then(timeout)
				.catch((err) => {
					log(err);
					timeout();
				});
		})
			.then(() => pause.setTimeout(() => sendMessagesLoop(), 0));

		sendMessagesLoop();
	}

	addChannel ({ channel, channelName }) {
		this.channels[channelName] = channel;
	}

	getChannel ({ channelName }) {
		return this.channels[channelName];
	}

	queueMessage ({
		announce, channel, channelName = Date.now(), event
	}) {
		if (channel && !this.getChannel(channelName)) {
			this.addChannel({ channel, channelName });
		}

		this.queue.push({ announce, channelName, event });
	}

	// Normally send messages for all channels when called, but allow this to be overriden as needed
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

				if (!message || (message.channelName !== item.channelName)) {
					message = {
						announcements: [],
						channelName: item.channelName,
						events: []
					};

					messages.push(message);
				}

				if (item.announce) message.announcements.push(item.announce);
				if (item.event) message.events.push(item.event);

				return messages;
			}, []))
			.then(messages => Promise.map(messages, (message) => {
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
