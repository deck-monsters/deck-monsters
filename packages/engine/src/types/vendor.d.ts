declare module 'roll' {
	interface RollResult {
		result: number;
		calculations: number[];
		input: string;
	}

	class Roll {
		roll(dice: string): RollResult;
	}

	export = Roll;
}

declare module 'fantasy-names' {
	function fantasyNames(
		theme: string,
		type: string,
		count?: number,
		gender?: number
	): string;

	export = fantasyNames;
}

declare module 'grab-color-names' {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const grabColorNames: any;
	export default grabColorNames;
	export function randomColor(): [string, string];
}

declare module 'node-emoji' {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const nodeEmoji: any;
	export default nodeEmoji;
	export function get(name: string): string;
	export function random(): { emoji: string; key: string };
}
