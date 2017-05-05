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

console.log(`${monsterA.icon} ${monsterA.givenName} ${monsterA.hp} vs ${monsterB.icon} ${monsterB.givenName} ${monsterB.hp}`);

const { getFlavor } = require('./helpers/flavor');

const announceHit = (Monster, monster, info) => {
	const { assailant, damage, hp } = info;

	let icon = '🤜';
	if (damage >= 10) {
		icon = '🔥';
	} else if (damage >= 5) {
		icon = '🔪';
	} else if (damage === 1) {
		icon = '🏓';
	}

	console.log(`${assailant.icon}  ${icon} ${monster.icon}    ${assailant.givenName} ${getFlavor('hits')} ${monster.givenName} for ${damage} damage`);

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
