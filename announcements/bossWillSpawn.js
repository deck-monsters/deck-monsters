const moment = require('moment');

const announceBossWillSpawn = (publicChannel, channelManager, className, ring, { delay }) => {
	publicChannel({
		announce: `A boss will enter the ring ${moment().add(delay).fromNow()}`
	});

	channelManager.sendMessages();
};

module.exports = announceBossWillSpawn;
