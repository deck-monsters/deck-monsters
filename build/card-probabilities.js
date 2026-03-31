import { startCase } from '../packages/engine/src/helpers/start-case.js';
import { draw } from '../packages/engine/src/cards/index.js';
import { randomCharacter } from '../packages/engine/src/characters/index.js';
import { all as Monsters } from '../packages/engine/src/monsters/index.js';

function getCardProbabilities () {
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

		const results = {};
		for (let i = 0; i < 20000; i++) {
			const card = draw(undefined, character);
			results[card.cardType] = (results[card.cardType] || 0) + 1;
		}

		probabilities[startCase(character.displayLevel)] = Object
			.keys(results)
			.sort((key1, key2) => results[key1] - results[key2])
			.map(key => `${key}: ${Math.round(results[key] / 200)}%`);

		return probabilities;
	}, {});
}

export default getCardProbabilities;
