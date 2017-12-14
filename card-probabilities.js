const { draw } = require('./cards');
const { randomCharacter } = require('./characters');
const { all: Monsters } = require('./monsters');

const character = randomCharacter({
	battles: {
		total: 15,
		wins: 15,
		losses: 0
	},
	Monsters
});

const results = {};
for (let i = 0; i < 100000; i++) {
	const card = draw(undefined, character);
	results[card.cardType] = (results[card.cardType] || 0) + 1;
}

Object.keys(results).sort((key1, key2) => results[key1] - results[key2]).forEach((key) => {
	console.log(`${key}: ${Math.round(results[key] / 10) / 100}%`); // eslint-disable-line no-console
});

// Beginner
// Flee: 5.42%
// Fight or Flight: 5.51%
// Random Play: 11.45%
// Heal: 17.86%
// Blast: 17.87%
// Hit: 41.9%

// Level 1
// Soften: 3.48%
// Flee: 3.53%
// Harden: 3.6%
// Brain Drain: 3.62%
// Fight or Flight: 3.66%
// Enchanted Faceswap: 7.26%
// Random Play: 7.37%
// Fists of Virtue: 7.4%
// Heal: 11.36%
// Wooden Spear: 11.42%
// Blast: 11.5%
// Hit: 25.81%

// Level 2
// Soften: 2.49%
// Harden: 2.49%
// Basic Shield: 2.51%
// Flee: 2.52%
// Thick Skin: 2.52%
// Scotch: 2.52%
// Fight or Flight: 2.54%
// Brain Drain: 2.54%
// Hit Harder: 5.03%
// Fists of Virtue: 5.07%
// Rehit: 5.08%
// Enchanted Faceswap: 5.08%
// Random Play: 5.1%
// Lucky Strike: 5.14%
// Blast: 7.91%
// Whiskey Shot: 7.97%
// Heal: 7.97%
// Wooden Spear: 8.05%
// Hit: 17.48%

// Level 3
// Fight or Flight: 2.25%
// Basic Shield: 2.29%
// Flee: 2.35%
// Venegeful Rampage: 2.36%
// Soften: 2.39%
// Thick Skin: 2.4%
// Harden: 2.42%
// Pound: 2.43%
// Brain Drain: 2.44%
// Scotch: 2.46%
// Hit Harder: 4.79%
// Lucky Strike: 4.85%
// Random Play: 4.86%
// Rehit: 4.92%
// Enchanted Faceswap: 4.93%
// Fists of Virtue: 5%
// Whiskey Shot: 7.49%
// Heal: 7.51%
// Wooden Spear: 7.56%
// Blast: 7.68%
// Hit: 16.63%
