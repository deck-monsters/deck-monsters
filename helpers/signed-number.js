module.exports = { signedNumber: number => (number === 0 ? '' : ` ${(number > 0 ? `+${number}` : number.toString())}`) };
