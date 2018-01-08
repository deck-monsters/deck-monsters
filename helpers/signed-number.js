module.exports = { signedNumber: number => (!number ? '' : ` ${(number > 0 ? `+${number}` : number.toString())}`) };
