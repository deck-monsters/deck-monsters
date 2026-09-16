import flavor from '../helpers/flavor.js';
import type { RoomEventBus } from '../events/index.js';

interface FloorIcon {
	floor: number;
	icon: string;
}

const defaultIcons: FloorIcon[] = [
	{ floor: 10, icon: '🔥' },
	{ floor: 5, icon: '🔪' },
	{ floor: 2, icon: '🤜' },
	{ floor: 1, icon: '🏓' },
	{ floor: 0, icon: '💋' },
];

interface HitOpts {
	assailant: any;
	card: any;
	damage: number;
	prevHp: number;
}

export function announceHit(
	eb: RoomEventBus,
	className: string,
	monster: any,
	{ assailant, card, damage, prevHp }: HitOpts,
): void {
	const flavors = card && card.flavors;
	const flavorResult = (card && card.flavor) || flavor.getFlavor('hits', flavors);

	let icon: string;
	if (flavorResult.icon) {
		icon = flavorResult.icon;
	} else {
		const icons: FloorIcon[] = (card && card.flavorIcons) || defaultIcons;
		icons.sort((a, b) => b.floor - a.floor);
		icon = icons.find(i => damage >= i.floor)!.icon;
	}

	const bloodied =
		monster.bloodied && prevHp > monster.bloodiedValue
			? `${monster.givenName} is now bloodied. `
			: '';
	const only = monster.bloodied && monster.hp > 0 ? 'only ' : '';

	let flavorText: string;
	if (card && card.flavorText) {
		flavorText = card.flavorText;
	} else {
		const target =
			monster === assailant ? `${monster.pronouns.him}self by mistake` : monster.givenName;
		flavorText = `${assailant.icon} ${icon} ${monster.icon}  ${assailant.givenName} ${flavorResult.text} ${target} for ${damage} damage.`;
	}

	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `${flavorText}\n\n${monster.icon} *${bloodied}${monster.givenName} has ${only}${monster.hp}HP.*\n`,
		// This used to publish an empty payload, so the one number the event is *about*
		// was recoverable only by parsing the prose. Consumers that want to weigh a hit —
		// the web console's fight highlights, and anything after it — need the figures,
		// and `maxHp` in particular: 9 damage is a scratch on a boss and near-lethal on a
		// beginner, so significance is a ratio, not a constant.
		payload: {
			damage,
			prevHp,
			hp: monster.hp,
			maxHp: monster.maxHp,
			bloodied: Boolean(monster.bloodied),
			monsterName: monster.givenName,
			assailantName: assailant?.givenName,
		},
	});
}
