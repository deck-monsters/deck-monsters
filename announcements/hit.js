/* eslint-disable max-len */
const { getFlavor } = require('../helpers/flavor');

const defaultIcons = [
	{ floor: 10, icon: '🔥' },
	{ floor: 5, icon: '🔪' },
	{ floor: 2, icon: '🤜' },
	{ floor: 1, icon: '🏓' },
	{ floor: 0, icon: '💋' }
];

const announceHit = (className, monster, {
	assailant,
	card,
	damage,
	prevHp
}) => {
	const flavors = card && card.flavors;
	const flavor = (card && card.flavor) || getFlavor('hits', flavors);

	let icon;
	if (flavor.icon) {
		({ icon } = flavor);
	} else {
		const icons = (card && card.flavorIcons) || defaultIcons;
		icons.sort((a, b) => b.floor - a.floor);
		({ icon } = icons.find(i => damage >= i.floor));
	}

	const bloodied = (monster.bloodied && prevHp > monster.bloodiedValue) ? `${monster.givenName} is now bloodied. ` : '';
	const only = (monster.bloodied && monster.hp > 0) ? 'only ' : '';
	let flavorText;
	if (card && card.flavorText) {
		({ flavorText } = card);
	} else {
		const target = monster === assailant ? `${monster.pronouns.him}self by mistake` : monster.givenName;
		flavorText = `${assailant.icon} ${icon} ${monster.icon}  ${assailant.givenName} ${flavor.text} ${target} for ${damage} damage.`;
	}

	monster.environment.channel({
		announce:
`${flavorText}

${monster.icon} *${bloodied}${monster.givenName} has ${only}${monster.hp}HP.*
`
	});
};

module.exports = announceHit;
