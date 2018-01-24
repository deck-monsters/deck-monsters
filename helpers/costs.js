const reduce = require('lodash.reduce');

const all = {
	FREE: { cost: 0, name: 'free', icon: '' },
	ALMOST_NOTHING: { cost: 10, name: 'almost nothing', icon: '$' },
	VERY_CHEAP: { cost: 20, name: 'a song', icon: '$$' },
	CHEAP: { cost: 30, name: 'cheap', icon: '$$$' },
	REASONABLE: { cost: 50, name: 'reasonable', icon: '$$$$' },
	PRICEY: { cost: 80, name: 'pricey', icon: '$$$$$' },
	EXPENSIVE: { cost: 130, name: 'expensive', icon: '$$$$$$' }
};

const findCostMatch = cost => reduce(all, (result, possibility) => {
	if (cost <= possibility.cost && possibility.cost < result.cost) {
		return possibility;
	}

	return result;
}, all.EXPENSIVE);

module.exports = {
	...all,
	findCostMatch
};
