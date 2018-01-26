const reduce = require('lodash.reduce');

const all = {
	IMPOSSIBLE: { probability: 0, name: 'impossible', icon: '✪' },
	EPIC: { probability: 5, name: 'epic', icon: '☆' },
	VERY_RARE: { probability: 10, name: 'very rare', icon: '★' },
	RARE: { probability: 15, name: 'rare', icon: '◇' },
	UNCOMMON: { probability: 25, name: 'uncommon', icon: '◆' },
	COMMON: { probability: 40, name: 'common', icon: '○' },
	ABUNDANT: { probability: 65, name: 'abundant', icon: '•' }
};

const findProbabilityMatch = probability => reduce(all, (result, possibility) => {
	if (probability <= possibility.probability && possibility.probability < result.probability) {
		return possibility;
	}

	return result;
}, all.ABUNDANT);

module.exports = {
	...all,
	findProbabilityMatch
};
