export const signedNumber = (number: number): string =>
	!number ? '' : ` ${number > 0 ? `+${number}` : number.toString()}`;
