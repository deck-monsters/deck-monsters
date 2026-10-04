/**
 * Joins names into prose: "A", "A and B", "A, B and C". Player-facing text uses "and",
 * not an Oxford comma (docs/reference/voice-and-wording.md).
 */
const joinList = (names: string[]): string => {
	if (names.length <= 1) return names.join('');
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

export { joinList };
export default joinList;

/**
 * Like `joinList`, but a name that appears more than once is grouped as "Name ×n" (in order of
 * first appearance), so two Bandages read "Bandage ×2" rather than "Bandage and Bandage".
 */
const joinGrouped = (names: string[]): string => {
	const counts = new Map<string, number>();
	names.forEach(name => counts.set(name, (counts.get(name) ?? 0) + 1));
	return joinList([...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)));
};

export { joinGrouped };
