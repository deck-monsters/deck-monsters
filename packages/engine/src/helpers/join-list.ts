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
