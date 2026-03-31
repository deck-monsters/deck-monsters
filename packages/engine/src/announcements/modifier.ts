import { signedNumber } from '../helpers/signed-number.js';

type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

interface ModifierOpts {
	amount: number;
	attr: string;
	prevValue: number;
}

export function announceModifier(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	monster: any,
	{ amount, attr, prevValue }: ModifierOpts,
): void {
	const newValue = monster[attr] as number;
	const totalMod = monster.encounterModifiers[attr] as number;
	const difference = newValue - prevValue;

	const dir = amount < 0 ? 'decreased' : 'increased';
	const total = totalMod !== amount ? `,${signedNumber(totalMod)} total` : '';

	if (difference === 0) {
		publicChannel({
			announce: `${monster.identity}'s ${attr} could not be ${dir} and remains the same.`,
		});
	} else if (difference !== amount) {
		publicChannel({
			announce: `${monster.identity}'s ${attr} could not be ${dir} by ${Math.abs(amount)}, ${monster.pronouns.his} ${attr} is now ${newValue} (${dir} by ${Math.abs(difference)}${total})`,
		});
	} else {
		publicChannel({
			announce: `${monster.identity}'s ${attr} is now ${newValue} (${dir} by ${Math.abs(amount)}${total})`,
		});
	}
}
