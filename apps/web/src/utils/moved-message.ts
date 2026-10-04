/** "Moved 1 card to X." / "Moved 2 cards to X." (pass 43 I1: it used to say "1 cards"). */
export function movedToMessage(count: number, monsterName: string): string {
  return `Moved ${count} ${count === 1 ? 'card' : 'cards'} to ${monsterName}.`;
}
