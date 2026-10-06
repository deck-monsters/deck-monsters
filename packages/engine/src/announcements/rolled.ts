import { signedNumber } from '../helpers/signed-number.js';
import type { RoomEventBus } from '../events/index.js';
import type { FeedLine } from '../events/types.js';

type RollFlags = {
	primaryDice?: string;
	strokeOfLuck?: boolean;
	curseOfLoki?: boolean;
};

type RollWithParts = RollFlags & {
	naturalRoll: { result: number | string };
	bonusResult: number;
	modifier: number;
	result?: number | string;
};

type RollWithResultOnly = RollFlags & {
	result: number | string;
	naturalRoll?: { result?: number | string };
	bonusResult?: number;
	modifier?: number;
};

type RollResult = RollWithParts | RollWithResultOnly;

interface RolledOpts {
	outcome?: string;
	reason: string;
	roll?: RollResult;
	vs?: number | string;
	/**
	 * The card's own decision, when it made one. Cards judge differently (Fire Breath meets
	 * its difficulty to dodge, a flee needs 10 or higher and shows no `vs`), so the feed line
	 * takes this over the default "total beats vs" rule.
	 */
	success?: boolean;
	who: any;
}

const outcomeLines = (outcome: string): FeedLine[] =>
	outcome
		.split('\n')
		.map(line => line.trim())
		.filter(line => line !== '')
		.map(line => ({ kind: 'outcome', text: line }) satisfies FeedLine);

const toNumber = (value: unknown): number | undefined => {
	if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
};

export function announceRolled(
	eb: RoomEventBus,
	className: string,
	monster: any,
	{ outcome, reason, roll, vs, who, success }: RolledOpts,
): void {
	const numericNatural = toNumber(roll?.naturalRoll?.result);
	const naturalRoll = numericNatural ?? roll?.naturalRoll?.result ?? 0;
	const bonusResult = toNumber(roll?.bonusResult) ?? 0;
	const modifier = toNumber(roll?.modifier) ?? 0;
	const fallbackResult = numericNatural === undefined ? undefined : numericNatural + bonusResult + modifier;
	const result = roll?.result ?? fallbackResult ?? 0;
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

	// Facts for the structured twin. `bonus` folds the bonus dice and the modifier together
	// (the text shows them as two signed numbers); `result` mirrors the verdict line: a
	// natural 20 / critical failure first, then success against `vs` (a tie goes to the
	// defender, as in `hitCheck`), and plain success when there is nothing to beat.
	const numericVs = vs ? Number(vs) : undefined;
	const vsValue = numericVs !== undefined && Number.isFinite(numericVs) ? numericVs : undefined;
	// Composite rolls (Blink's hp and XP dice) have authored strings, not a single total.
	// Keep those strings in text and leave unavailable facts out rather than inventing zero.
	const total = toNumber(roll?.result ?? fallbackResult);
	const hasRollParts = roll?.naturalRoll?.result !== undefined || roll?.bonusResult !== undefined || roll?.modifier !== undefined;
	const natural = hasRollParts ? numericNatural : total;
	const verdict: 'success' | 'fail' | 'nat20' | 'nat1' | undefined = roll?.curseOfLoki
		? 'nat1'
		: roll?.strokeOfLuck
			? 'nat20'
			: success !== undefined
				? (success ? 'success' : 'fail')
				: total === undefined
					? undefined
					: vsValue !== undefined && !(total > vsValue)
						? 'fail'
						: 'success';
	const verdictText = `🎲 *${rollResult}${vsMsg}*`;
	const lines: FeedLine[] = [
		{
			kind: 'roll',
			text,
			who: whoName,
			...(roll?.primaryDice ? { die: roll.primaryDice } : {}),
			...(natural === undefined ? {} : { natural }),
			bonus: bonusResult + modifier,
			...(total === undefined ? {} : { total }),
			...(vsValue === undefined ? {} : { vs: vsValue }),
			...(verdict === undefined ? {} : { result: verdict }),
			...(reason ? { reason } : {}),
		},
		{
			kind: 'verdict',
			text: verdictText,
			...(total === undefined ? {} : { total }),
			...(vsValue === undefined ? {} : { vs: vsValue }),
			...(verdict === undefined ? {} : { result: verdict }),
		},
		...(outcome ? outcomeLines(outcome) : []),
	];

	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `${text}\n${verdictText}${outcome ? `\n    ${outcome}` : ''}\n `,
		payload: { roll: roll ?? { result }, who, outcome, lines },
	});
}
