const isMatchingItem = (item1: { name: string }, item2: { name: string }): boolean =>
	item1.name === item2.name && JSON.stringify(item1) === JSON.stringify(item2);

export default isMatchingItem;
export { isMatchingItem };
