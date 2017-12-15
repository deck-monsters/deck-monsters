/* eslint-disable no-console */

const startCase = require('lodash.startcase');

const { draw } = require('./cards');
const { randomCharacter } = require('./characters');
const { all: Monsters } = require('./monsters');

const levels = [1, 5, 10, 15, 25, 40];

levels.forEach((wins) => {
	const character = randomCharacter({
		battles: {
			total: wins,
			wins,
			losses: 0
		},
		Monsters
	});

	const results = {};
	for (let i = 0; i < 10000; i++) {
		const card = draw(undefined, character);
		results[card.cardType] = (results[card.cardType] || 0) + 1;
	}

	console.log('\n');
	console.log(`*${startCase(character.displayLevel)}*`);
	Object.keys(results).sort((key1, key2) => results[key1] - results[key2]).forEach((key) => {
		console.log(`${key}: ${Math.round(results[key] / 100)}%`);
	});
});

// *Beginner*
// Flee: 6%
// Random Play: 9%
// Heal: 12%
// Blast: 19%
// Fight or Flight: 20%
// Hit: 34%
//
//
// *Level 1*
// The Kalevala (1d4): 2%
// Flee: 3%
// Harden: 5%
// Brain Drain: 5%
// Soften: 5%
// Random Play: 5%
// Heal: 7%
// Fists of Virtue: 7%
// Enchanted Faceswap: 9%
// Fight or Flight: 11%
// Blast: 11%
// Wooden Spear: 11%
// Hit: 18%
//
//
// *Level 2*
// The Kalevala (1d4): 1%
// Scotch: 2%
// Flee: 2%
// Brain Drain: 3%
// Thick Skin: 4%
// Random Play: 4%
// Harden: 4%
// Lucky Strike: 4%
// Soften: 4%
// Basic Shield: 4%
// Whiskey Shot: 5%
// Fists of Virtue: 5%
// Heal: 5%
// Enchanted Faceswap: 6%
// Rehit: 6%
// Hit Harder: 7%
// Blast: 7%
// Wooden Spear: 8%
// Fight or Flight: 8%
// Hit: 12%
//
//
// *Level 3*
// The Kalevala (1d4): 1%
// Pound: 1%
// Vengeful Rampage: 2%
// Scotch: 2%
// Flee: 2%
// Random Play: 3%
// Thick Skin: 3%
// Basic Shield: 3%
// Lucky Strike: 3%
// Brain Drain: 3%
// Soften: 4%
// Harden: 4%
// Whiskey Shot: 5%
// Fists of Virtue: 5%
// Heal: 5%
// Hit Harder: 6%
// Rehit: 6%
// Enchanted Faceswap: 6%
// Wooden Spear: 7%
// Fight or Flight: 7%
// Blast: 7%
// Hit: 11%
//
//
// *Level 4*
// The Kalevala (1d4): 1%
// Pound: 1%
// Vengeful Rampage: 2%
// Flee: 2%
// Scotch: 3%
// Harden: 3%
// Lucky Strike: 3%
// Basic Shield: 3%
// Brain Drain: 3%
// Random Play: 4%
// Thick Skin: 4%
// Soften: 4%
// Fists of Virtue: 4%
// Whiskey Shot: 5%
// Heal: 5%
// Enchanted Faceswap: 6%
// Rehit: 6%
// Hit Harder: 6%
// Blast: 7%
// Fight or Flight: 8%
// Wooden Spear: 8%
// Hit: 11%
//
//
// *Level 5*
// The Kalevala (1d4): 1%
// Pound: 1%
// Flee: 2%
// Vengeful Rampage: 2%
// Scotch: 2%
// Lucky Strike: 3%
// Thick Skin: 3%
// Basic Shield: 4%
// Soften: 4%
// Harden: 4%
// Brain Drain: 4%
// Random Play: 4%
// Whiskey Shot: 5%
// Fists of Virtue: 5%
// Heal: 5%
// Hit Harder: 6%
// Enchanted Faceswap: 6%
// Rehit: 6%
// Fight or Flight: 7%
// Wooden Spear: 7%
// Blast: 8%
// Hit: 11%
