const { percent } = require('./chance');
const shuffle = require('lodash.shuffle');

const flavor = {
	getFlavor (category) {
		const possibleWords = shuffle(flavor.flavors[category]);

		const words = possibleWords.find(card => percent() <= card[1]) || flavor.getFlavor(category);

		return words[0];
	},

	flavors: {
		hits: [
			['punches', 80],
			['slices', 70],
			['smacks', 70],
			['trounces', 70],
			['bashes', 70],
			['stabs', 70],
			['mauls', 70],
			['bites', 50],
			['incinerates', 50],
			['pulls on the hair of', 20],
			['farts in the general direction of', 5],
			['pokes', 10],
			['whaps', 30],
			['grabs by the lower half, twirls around in circles, and throws across the field mercilessly', 2]
		],
		monsterAdjective: [
			[' swanky', 1],
			[' fierce', 80],
			[' formidable', 80],
			[' terrifying', 80],
			[' giant', 80],
			[' disgusting', 50],
			[' chubby', 10],
			['n amazing', 60],
			['n awesome', 80],
			[' wild', 80],
			[' ferocious', 80],
			[' gargantuan', 60],
			[' wily', 40],
			[' slobbery, stinking, putrid, and seemingly un-dead', 5],
			[', for some reason, slime-covered', 1],
			['n aged', 3],
			[' young', 25],
			['n enraged', 80],
			[' muscle-bound', 80],
			[' terrified', 5],
			[' cowardly, shaking, weak-kneed, gibbering, snot-sobbing, sorry excuse for a monster, who the entire crowd feels nothing but pity for', 1],
			[' swaggering', 80],
			[' roaring', 80],
			[' braggardly', 40],
			[' strutting', 30],
			[' growling', 70],
			[' hilariously idiotic looking', 8],
			[' fearsome', 80],
			[' lazy', 30],
			[' well-groomed', 35],
			[' well-fed', 50],
			['n awe-inspiring', 80],
			[' somewhat harmless looking', 10],
			['n obviously abused', 20],
			[' seemingly bored', 10],
			['n overly confident', 10],
			['n unconcerned', 10],
			[' cautious', 10],
			[' fell', 60],
			[' dark', 60],
			[' demonic', 30],
			[' stolid', 20],
			[' stoic', 10],
			[' calm, collected, and all around confident', 10],
			['n innocuous ', 3],
			[' very sweet and cute looking', 5]
		]
	}
};

module.exports = flavor;
