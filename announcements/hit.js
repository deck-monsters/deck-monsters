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
	const flavor = (card && card.flavor) || getFlavor('hits', flavors);

	let icon;
	if (flavor[2]) {
		icon = flavor[2];
	} else {
		const icons = (card && card.flavorIcons) || defaultIcons;
		icons.sort((a, b) => b.floor - a.floor);
		icon = icons.find(i => damage >= i.floor).icon;
	}

	const bloodied = (monster.bloodied && prevHp > monster.bloodiedValue) ? `${monster.givenName} is now bloodied. ` : '';
	const only = (monster.bloodied && monster.hp > 0) ? 'only ' : '';
	const defaultFlavorText = `${assailant.icon} ${icon} ${monster.icon}  ${assailant.givenName} ${flavor[0]} ${monster.givenName} for ${damage} damage.`;

	const flavorText = (card && card.flavorText) || defaultFlavorText;

	publicChannel({
		announce:
`${flavorText}

${monster.icon}  *${bloodied}${monster.givenName} has ${only}${monster.hp}HP.*
`
	});
};

module.exports = announceHit;
