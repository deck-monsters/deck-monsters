/* eslint-disable no-console */
import { writeFileSync } from 'fs';

import cardCatalogue from './card-catalogue.js';
import cardCatalogueAsHTML from './card-catalogue-as-html.js';
import dungeonMasterGuide from './dungeon-master-guide.js';
import getCardDPT from './card-odds.js';
import getCardProbabilities from './card-probabilities.js';
import monsterManual from './monster-manual.js';
import playerHandbook from './player-handbook.js';

const writeToFile = (name, string, suffix = 'md') =>
	writeFileSync(`${name}.${suffix}`, string);

Promise.resolve()
	.then(() => {
		if (process.argv[2] === '--calculate-stats') {
			console.log('Calculating card stats, this will take some time...');
			writeToFile('card-odds', JSON.stringify(getCardDPT(), null, 2), 'json');
			writeToFile('card-probabilities', JSON.stringify(getCardProbabilities(), null, 2), 'json');
		} else {
			console.log('Skipping stats calculation. Pass --calculate-stats to re-calculate card stats.');
		}
	})
	.then(() => {
		const content = [];
		return dungeonMasterGuide({ output: section => content.push(section) })
			.then(() => writeToFile('DMG', content.join('\n')));
	})
	.then(() => {
		const content = [];
		return cardCatalogue({ output: section => content.push(section) })
			.then(() => writeToFile('CARDS', content.join('\n')));
	})
	.then(() => {
		const content = [];
		return monsterManual({ output: section => content.push(section) })
			.then(() => writeToFile('MONSTERS', content.join('\n')));
	})
	.then(() => {
		const content = [];
		return playerHandbook({ output: section => content.push(section) })
			.then(() => writeToFile('PLAYER_HANDBOOK', content.join('\n')));
	})
	.then(() => {
		const content = [];
		return cardCatalogueAsHTML({ output: section => content.push(section) })
			.then(() => writeToFile('cards', content.join('\n'), 'html'));
	})
	.then(() => {
		console.log('Done!');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Build failed:', err);
		process.exit(1);
	});
