const announceFight = (publicChannel, channelManager, className, ring, { contestants }) => {
	publicChannel({
		announce: `
_______________________________________________________________________________________________________
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
${contestants.length} contestants stand tall under the laudations and hissing jeers of a roaring crowd.

⚔︎ Let the games begin! ⚔︎
`
	});
};

module.exports = announceFight;
