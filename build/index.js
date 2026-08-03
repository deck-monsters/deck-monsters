/* eslint-disable no-console */
import { writeFileSync } from 'fs';

import { generateRootDocs } from '../packages/engine/dist/build/root-docs.js';
import getCardDPT from './card-odds.js';
import getCardProbabilities from './card-probabilities.js';

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
	.then(() => generateRootDocs(writeToFile))
	.then(() => {
		console.log('Done!');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Build failed:', err);
		process.exit(1);
	});
