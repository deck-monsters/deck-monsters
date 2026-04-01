import { signedNumber } from '../helpers/signed-number.js';
import type { RoomEventBus } from '../events/index.js';

interface RollResult {
	naturalRoll: { result: number };
	bonusResult: number;
	modifier: number;
	primaryDice?: string;
	strokeOfLuck?: boolean;
	curseOfLoki?: boolean;
	result: number | string;
}

interface RolledOpts {
	outcome?: string;
	reason: string;
	roll: RollResult;
	vs?: number | string;
	who: any;
}

export function announceRolled(
	eb: RoomEventBus,
	className: string,
	monster: any,
	{ outcome, reason, roll, vs, who }: RolledOpts,
): void {
	let rollDesc = `${roll.naturalRoll.result}${signedNumber(roll.bonusResult)}${signedNumber(roll.modifier)}`;
	if (roll.primaryDice) rollDesc = `${rollDesc} on ${roll.primaryDice}`;

	const text = `${who.givenName} rolled _${rollDesc}_ ${reason}`;

	const vsMsg = vs ? ` v ${vs}` : '';
	let rollResult: string = roll.strokeOfLuck ? 'Nat 20!' : String(roll.result);
	if (roll.curseOfLoki) rollResult = 'Crit Fail!';

	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `${text}\n🎲 *${rollResult}${vsMsg}*${outcome ? `\n    ${outcome}` : ''}\n `,
		payload: { roll, who, outcome },
	});
}
