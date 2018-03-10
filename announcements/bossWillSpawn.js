const moment = require('moment');

const announceBossWillSpawn = (className, ring, { delay }) => {
	ring.channel({
		announce: `A boss will enter the ring ${moment().add(delay).fromNow()}`
	});

	ring.channelManager.sendMessages();
};

module.exports = announceBossWillSpawn;
