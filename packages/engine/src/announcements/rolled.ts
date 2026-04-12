import { signedNumber } from '../helpers/signed-number.js';
import type { RoomEventBus } from '../events/index.js';

interface RollResult {
	naturalRoll?: { result?: number };
	bonusResult?: number;
	modifier?: number;
	primaryDice?: string;
	strokeOfLuck?: boolean;
	curseOfLoki?: boolean;
	result?: number | string;
}

interface RolledOpts {
	outcome?: string;
	reason: string;
	roll?: RollResult;
	vs?: number | string;
	who: any;
}

const toNumber = (value: unknown, fallback = 0): number => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

export function announceRolled(
	eb: RoomEventBus,
	className: string,
	monster: any,
	{ outcome, reason, roll, vs, who }: RolledOpts,
): void {
	const naturalRoll = toNumber(roll?.naturalRoll?.result);
	const bonusResult = toNumber(roll?.bonusResult);
	const modifier = toNumber(roll?.modifier);
	const fallbackResult = naturalRoll + bonusResult + modifier;
	const result = roll?.result ?? fallbackResult;
	const hasDetailedRollDescription = roll?.naturalRoll?.result !== undefined ||
		roll?.bonusResult !== undefined ||
		roll?.modifier !== undefined ||
		!!roll?.primaryDice;

	let rollDesc = hasDetailedRollDescription
		? `${naturalRoll}${signedNumber(bonusResult)}${signedNumber(modifier)}`
		: `${result}`;
	if (roll?.primaryDice) rollDesc = `${rollDesc} on ${roll.primaryDice}`;

	const whoName = who?.givenName ?? 'Someone';
	const text = `${whoName} rolled _${rollDesc}_ ${reason}`;

	const vsMsg = vs ? ` v ${vs}` : '';
	let rollResult: string = roll?.strokeOfLuck ? 'Nat 20!' : String(result);
	if (roll?.curseOfLoki) rollResult = 'Crit Fail!';

	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `${text}\n🎲 *${rollResult}${vsMsg}*${outcome ? `\n    ${outcome}` : ''}\n `,
		payload: { roll: roll ?? { result }, who, outcome },
	});
}
