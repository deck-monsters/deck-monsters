const announceFight = (publicChannel, channelManager, className, ring, { contestants }) => {
	publicChannel({
		announce: `${contestants.length} contestants stand tall under the laudations and hissing jeers of a roaring crowd.
${contestants.map(contestant => contestant.monster.identityWithHp).join(' vs ')}

Let the games begin!`
	});
};

module.exports = announceFight;
