// The maximum and minimum are inclusive
module.exports = (min, max) => {
	const trueMin = Math.ceil(min);
	const trueMax = Math.floor(max);
	return Math.floor(Math.random() * ((trueMax - trueMin) + 1)) + trueMin;
};
