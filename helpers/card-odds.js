const { randomCharacter } = require('../characters');
const { all: Monsters } = require('../monsters');
const { all: Cards } = require('../cards');

function getCardDPT () {
	const levels = [1, 5, 10, 15, 25];

	return levels.reduce((probabilities, wins) => {
		const character = randomCharacter({
			battles: {
				total: wins,
				wins,
				losses: 0
			},
			Monsters
		});

		const cards = Cards.map(Card => new Card());
		const plays = {};

		const ring = {
			contestants: [
				{ monster: character.monsters[0] },
				{ monster: character.monsters[1] },
				{ monster: character.monsters[2] },
				{ monster: character.monsters[3] },
				{ monster: character.monsters[4] }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			},
			encounterEffects: []
		};

		for (let i = 0; i < 100; i++) {
			character.monsters.forEach((player) => {
				cards.forEach((card) => {
					character.monsters.forEach((target) => {
						target.hp = Math.ceil(target.maxHp / 2) + 10;
						target.encounterEffects = [];
						player.encounterEffects = [];
						ring.encounterEffects = [];
						target.encounterModifiers = {};
						const beforeHP = target.hp;

						try {
							card.effect(player, target, ring);
						} catch (e) {
							// console.log('err on card', card.name)
						}

						if (target.encounterEffects.length > 0 || ring.encounterEffects > 0) {
							plays[card.name] = plays[card.name] || {};
							plays[card.name].effects = plays[card.name].effects + 1 || 1;
						}

						if (target.encounterModifiers.length > 0) {
							plays[card.name] = plays[card.name] || {};
							plays[card.name].modifiers = plays[card.name].modifiers + 1 || 1;
						}


						if (target.hp < beforeHP) {
							const dmg = beforeHP - target.hp;
							plays[card.name] = plays[card.name] || {};
							plays[card.name].hits = plays[card.name].hits + 1 || 1;
							plays[card.name].damage = plays[card.name].damage + dmg || dmg;
						} else if (target.hp > beforeHP) {
							const heal = target.hp - beforeHP;
							plays[card.name] = plays[card.name] || {};
							plays[card.name].heals = plays[card.name].heals + 1 || 1;
							plays[card.name].health = plays[card.name].health + heal || heal;
							// console.log(`${card.name} healed target for ${target.hp - beforeHP} ${target.hp}`);
						} else {
							// console.log(`${card.name} had no effect`);
						}
					});
				});
			});
		}

		Object.keys(plays).map((cardName) => {
			const play = plays[cardName];

			if (play.hits) {
				play.hitChance = Math.round((play.hits / 2500) * 100);
				play.dpt = Math.round(play.damage / 2500);
			}

			if (play.heals) {
				play.healChance = Math.round((play.heals / 2500) * 100);
				play.hpt = Math.round(play.health / 2500);
			}

			if (play.effects) {
				play.effectChance = Math.round((play.effects / 2500) * 100);
			}

			if (play.modifiers) {
				play.modifierChance = Math.round((play.modifiers / 2500) * 100);
			}

			return play;
		});

		probabilities[character.level] = plays;

		// probabilities[startCase(character.displayLevel)] = Object
		// 	.keys(results)
		// 	.sort((key1, key2) => results[key1] - results[key2])
		// 	.map(key => `${key}: ${Math.round(results[key] / 200)}%`);

		return probabilities;
	}, {});
}

module.exports = getCardDPT;
