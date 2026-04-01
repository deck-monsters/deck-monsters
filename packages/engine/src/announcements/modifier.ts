import { signedNumber } from '../helpers/signed-number.js';
import type { RoomEventBus } from '../events/index.js';

interface ModifierOpts {
	amount: number;
	attr: string;
	prevValue: number;
}

export function announceModifier(
	eb: RoomEventBus,
	className: string,
	monster: any,
	{ amount, attr, prevValue }: ModifierOpts,
): void {
	const newValue = monster[attr] as number;
	const totalMod = monster.encounterModifiers[attr] as number;
	const difference = newValue - prevValue;

	const dir = amount < 0 ? 'decreased' : 'increased';
	const total = totalMod !== amount ? `,${signedNumber(totalMod)} total` : '';

	let text: string;
	if (difference === 0) {
		text = `${monster.identity}'s ${attr} could not be ${dir} and remains the same.`;
	} else if (difference !== amount) {
		text = `${monster.identity}'s ${attr} could not be ${dir} by ${Math.abs(amount)}, ${monster.pronouns.his} ${attr} is now ${newValue} (${dir} by ${Math.abs(difference)}${total})`;
	} else {
		text = `${monster.identity}'s ${attr} is now ${newValue} (${dir} by ${Math.abs(amount)}${total})`;
	}

	eb.publish({ type: 'announce', scope: 'public', text, payload: {} });
}
