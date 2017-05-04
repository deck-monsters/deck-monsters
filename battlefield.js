const cards = require('./cards');
const { percent } = require('./helpers/chance');
const shuffle = require('lodash.shuffle');
// const monsters = require('./monsters');
const Basilisk = require('./monsters/basilisk');
// const WeepingAngel = require('./monsters/weeping-angel');
const Minotaur = require('./monsters/minotaur');
const { globalSemaphore } = require('./helpers/semaphore');

const monsterA = new Basilisk();
// monsterA.look(({ announce }) => console.log(announce));
const deckA = cards.getInitialDeck();
// deckA.forEach((card) => { card.look(({ announce }) => console.log(announce)); });

console.log('');

const monsterB = new Minotaur();
// monsterB.look(({ announce }) => console.log(announce));
const deckB = cards.getInitialDeck();
// deckB.forEach((card) => { card.look(({ announce }) => console.log(announce)); });


console.log('');
console.log('Let the games begin!');
console.log('');

console.log(`${monsterA.icon} ${monsterA.givenName} ${monsterA.hp} vs ${monsterB.icon} ${monsterB.givenName} ${monsterB.hp}`);

const flavor = {
	get (category) {
		const possibleWords = shuffle(this.categories[category]);

		const words = possibleWords.find(card => percent() <= card[1]) || this.get(category);

		return words[0];
	},

	categories: {
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
			['grabs by the lower half, twirls around in circles, and throws across the field mercilessly ', 2]
		]
	}
};

const announceHit = (Monster, monster, info) => {
	const { assailant, damage, hp, prevHp } = info;

	console.log(`${assailant.icon}  🤜 ${monster.icon}    ${assailant.givenName} ${flavor.get('hits')} ${monster.givenName} for ${damage}`);

	if (hp <= 0) {
		console.log(`☠️    ${monster.givenName}'s gore paints the floor.`);
	}
};

const announceMiss = (Monster, monster, info) => {
	const { attackResult, curseOfLoki, player, target } = info;
	let action = 'is blocked by';
	let flavor = '';
	let icon = '🛡';

	if (curseOfLoki) {
		action = 'misses';
		flavor = 'horribly';
		icon = '💨';
	} else if (attackResult > 5) {
		action = 'is barely blocked by';
		icon = '⚔️';
	}

	console.log(`${player.icon} ${icon}  ${target.icon}    ${player.givenName} ${action} ${target.givenName} ${flavor}`);
};

const announceHeal = (Monster, monster, info) => {
	const { amount } = info;
	console.log(`${monster.icon} 💊       ${monster.givenName} heals ${amount} hp`);
};

globalSemaphore.on('card.miss', announceMiss);
globalSemaphore.on('creature.hit', announceHit);
globalSemaphore.on('creature.heal', announceHeal);

// monsterA.on('hit', announceHit);
// monsterB.on('hit', announceHit);
// monsterA.on('miss', announceMiss);
// monsterB.on('miss', announceMiss);


let cardA = 0;
let cardB = 0;
while (monsterA.hp > 0 && monsterB.hp > 0) {
	deckA[cardA].effect(monsterA, monsterB, 'A');

	if (monsterB.hp > 0) {
		deckB[cardB].effect(monsterB, monsterA, 'A');
	}

	cardA++;
	cardB++;

	if (cardA >= deckA.length) {
		cardA = 0;
	}

	if (cardB >= deckB.length) {
		cardB = 0;
	}
}
