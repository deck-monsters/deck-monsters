const { percent } = require('./chance');
const shuffle = require('lodash.shuffle');

const flavor = {
	getFlavor (category, flavors = flavor.flavors) {
		const possibleWords = shuffle(flavors[category] || flavor.flavors[category]);

		const words = possibleWords.find(word => percent() <= word[1]);

		if (!words) {
			return flavor.getFlavor(category, flavors);
		}

		return { text: words[0], icon: words[2] };
	},

	flavors: {
		hits: [
			['hits', 80],
			['slices', 70],
			['smacks', 70],
			['trounces', 70],
			['bashes', 70],
			['stabs', 70],
			['mauls', 70],
			['spanks', 50],
			['wallops', 50],
			['punches', 40],
			['whaps', 30],
			['pulls on the hair of', 20],
			['pokes', 10],
			['farts in the general direction of', 5],
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
			[' cowardly, shaking, weak-kneed, gibbering, snot-sobbing, sorry excuse for a monster, who the entire crowd feels nothing but pity for', 1], // eslint-disable-line max-len
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
			[' very sweet and cute looking', 5],
			[' fugly', 14],
			[' grody', 18],
			[' squishy', 12],
			[' fuzzy', 13],
			[' sleep deprived', 19],
			[' motherly --In the way that a mother bear between whom it and its cubs you have just stepped is motherly--', 40],
			[' not surprisingly, drunken', 20],
			[' rash-covered', 7],
			[' freshly bathed', 4],
			[' slovenly', 8],
			[' poorly dressed', 10],
			[' way too excited', 15],
			[' earnest, in an endearing sort of way', 10],
			[' genuinely stinky', 10],
			[' patently ridiculous', 10],
			[', for some reason dressed as Father Christmas,', 3],
			[' completely covered in warts', 5],
			[' cross-eyed', 3],
			[' fully-on ugly crying', 6],
			['n already blood soaked', 30],
			[' very very extremely, not exaggerating at all here, bone-skinny starving', 4],
			[' gregarious', 5],
			[' overly "handsy"', 2],
			[' clove smelling', 5],
			[' simply marvelous', 10],
			['n --of all things, dressed in a cheap-rented-tuxedo with a bizarre leopard print cumber-bun and bowtie, ', 1],
			[' weak looking', 2],
			[' stalwart', 25],
			['n ex-con', 14],
			[' one-time-baker-now-turned-brawler', 12],
			[' lopsidedly muscled', 15],
			[' freshly shaven, powdered, and then for some reason oiled', 9],
			[' very welcoming --if this isn\'t your grandma, you wish it was', 1],
			[' probably ocean-dwelling', 12],
			[' well spoken', 5],
			['n easily distracted', 10]
		]
	}
};

module.exports = flavor;
