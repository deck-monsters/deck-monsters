import all from './all.js';

/** Resolve a card constructor by its static `cardType` string (case-insensitive). */
export function getCardClassByTypeName(rawName: string): (typeof all)[number] {
	const key = rawName.trim().toLowerCase();
	for (const Ctor of all) {
		const t = (Ctor as { cardType?: string }).cardType;
		if (typeof t === 'string' && t.toLowerCase() === key) {
			return Ctor;
		}
	}
	throw new Error(`Unknown card type name: "${rawName}"`);
}
