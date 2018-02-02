const generateDocs = ({ channel, generate, output }) => {
	let format;

	if (channel) {
		const { channelManager, channelName } = channel;
		format = announce => channelManager.queueMessage({
			announce,
			channel,
			channelName
		});

		return generate(format).then(() => channelManager.sendMessages());
	} else if (output) {
		format = string => Promise.resolve().then(() => output(string));
	} else {
		format = string => Promise.resolve().then(() => console.log(string)); // eslint-disable-line no-console
	}

	return generate(format);
};

module.exports = generateDocs;
