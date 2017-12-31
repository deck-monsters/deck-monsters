const announceFight = (publicChannel, channelManager, className, ring, { contestants }) => {
	publicChannel({
		announce: contestants.map(contestant => contestant.monster.identityWithHp).join(' vs ')
	});
};

module.exports = announceFight;
