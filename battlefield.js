const cards = require('./cards');
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

console.log('monsterA.hp', monsterA.hp);
console.log('monsterB.hp', monsterB.hp);

const announceHit = (monster, Monster, info) => {
	const { assailant, damage, hp } = info;
	console.log(`${assailant.name} hits ${Monster.optionsStore.name} for ${damage}`);
	if (hp <= 0) {
		console.log(`${Monster.optionsStore.name}'s gore paints the floor.`);
	}
};

const announceMiss = (monster, Monster, info) => {
	const { attackResult, curseOfLoki, player, target } = info;
	let flavor = '';

	if (curseOfLoki) {
		flavor = 'horribly';
	} else if (attackResult > 5) {
		flavor = 'just barely';
	}

	console.log(`${player.name} misses ${target.name} ${flavor}`);
};

globalSemaphore.on('card.miss', announceMiss);
globalSemaphore.on('creature.hit', announceHit);

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
