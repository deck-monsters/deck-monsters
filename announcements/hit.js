const { getFlavor } = require('../helpers/flavor');

const defaultIcons = [
	{ floor: 10, icon: '🔥' },
	{ floor: 5, icon: '🔪' },
	{ floor: 2, icon: '🤜' },
	{ floor: 1, icon: '🏓' }
];

const announceHit = (publicChannel, channelManager, className, monster, {
	assailant,
	card,
	damage,
	prevHp
}) => {
	const flavors = card && card.flavors;
	const icons = (card && card.icons) || defaultIcons;

	icons.sort((a, b) => b.floor - a.floor);
	const { icon } = icons.find(i => damage >= i.floor);

	const bloodied = (monster.bloodied && prevHp > monster.bloodiedValue) ? `${monster.givenName} is now bloodied. ` : '';
	const only = (monster.bloodied && monster.hp > 0) ? 'only ' : '';

	publicChannel({
		announce:
`${assailant.icon} ${icon} ${monster.icon}  ${assailant.givenName} ${getFlavor('hits', flavors)} ${monster.givenName} for ${damage} damage.

${monster.icon}  *${bloodied}${monster.givenName} has ${only}${monster.hp}HP.*
`
	});
};

module.exports = announceHit;
