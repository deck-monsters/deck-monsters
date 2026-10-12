import { signedNumber } from '../helpers/signed-number.js';
import type { RoomEventBus } from '../events/index.js';
import { leadLines } from '../events/feed-lines.js';
import { getLevel } from '../helpers/levels.js';

interface ModifierOpts {
	amount: number;
	attr: string;
	prevValue: number;
	permanent?: boolean;
}

export function announceModifier(
	eb: RoomEventBus,
	className: string,
	monster: any,
	{ amount, attr, prevValue, permanent = false }: ModifierOpts,
): void {
	const newValue = monster[attr] as number;
	const totalMod = (permanent ? monster.modifiers : monster.encounterModifiers)[attr] as number;
	const difference = newValue - prevValue;

	const dir = amount < 0 ? 'decreased' : 'increased';
	// The running encounter total, when it differs from this one change. A total of zero
	// used to print as "(increased by 2, total)": `signedNumber(0)` is empty, so the sign
	// and number vanished and left a dangling word. Zero means the stat is back to normal,
	// which is said in words below instead.
	const total = totalMod !== amount && totalMod !== 0 ? `,${signedNumber(totalMod)} total` : '';

	let text: string;
	if (difference === 0) {
		text = `${monster.identity}'s ${attr} could not be ${dir} and remains the same.`;
	} else if (difference !== amount) {
		text = `${monster.identity}'s ${attr} could not be ${dir} by ${Math.abs(amount)}, ${monster.pronouns.his} ${attr} is now ${newValue} (${dir} by ${Math.abs(difference)}${total})`;
	} else if (totalMod === 0 && amount !== 0) {
		// A penalty or boost has ended (winded, exposed, a rest): say so, so the line does
		// not read as a fresh, unexplained buff.
		text = `${monster.identity}'s ${attr} is back to ${newValue} (${dir} by ${Math.abs(amount)})`;
	} else {
		text = `${monster.identity}'s ${attr} is now ${newValue} (${dir} by ${Math.abs(amount)}${total})`;
	}

	// Level is derived from xp, so a drained or boosted xp can move it, and with it max hp
	// and ac. Nothing said so: a Blink took a level 3 monster to level 2 and the roster
	// changed "Lvl 3 · AC 12" to "Lvl 2 · AC 11" with no line in the feed explaining why.
	let mechanic: string | undefined;
	if (attr === 'xp' && typeof prevValue === 'number') {
		const prevLevel = getLevel(prevValue);
		const level = monster.level as number;
		if (level !== prevLevel) {
			mechanic = 'fight-level';
			text += `. ${monster.givenName} ${level < prevLevel ? 'drops' : 'rises'} to level ${level} for this fight.`;
		}
	}

	eb.publish({
		type: 'announce',
		scope: 'public',
		text,
		payload: {
			...(mechanic ? { mechanic } : {}),
			lines: leadLines(text, line => ({
				kind: 'modifier',
				text: line,
				name: monster.givenName,
				attr,
				amount,
				value: newValue,
			})),
		},
	});
}
