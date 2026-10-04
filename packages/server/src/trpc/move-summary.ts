/**
 * Summary line for a card move. Why a helper: the move-many summary was a literal
 * "Moved ${n} cards", so a one-card move read "Moved 1 cards" (new-player walk 2, pass 43 I1).
 * Pass `cardName` for the single-card path ("Moved 1 Hit from A to B."); a plural count then
 * reads "Moved 2 Hit cards", matching the engine's own announcement in beastmaster.ts.
 */
export function movedSummary(movedCount: number, from: string, to: string, cardName?: string): string {
	const noun = cardName
		? `${cardName}${movedCount === 1 ? '' : ' cards'}`
		: movedCount === 1
			? 'card'
			: 'cards';
	return `Moved ${movedCount} ${noun} from ${from} to ${to}.`;
}
