/* eslint-disable no-console */
import { writeFileSync } from 'fs';

import getCardDPT from './card-odds.js';
import getCardProbabilities from './card-probabilities.js';

const ENGINE_DIST = '../packages/engine/dist/build/root-docs.js';

const writeToFile = (name, string, suffix = 'md') =>
	writeFileSync(`${name}.${suffix}`, string);

const loadGenerateRootDocs = async () => {
	try {
		const mod = await import(ENGINE_DIST);

		return mod.generateRootDocs;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(
			'Build failed: could not load engine doc generators from packages/engine/dist.\n' +
			'Run `pnpm run build:docs` (builds the engine, then generates docs) or `pnpm --filter @deck-monsters/engine build` first.\n' +
			`Underlying error: ${message}`
		);
		process.exit(1);
	}
};

Promise.resolve()
	.then(async () => {
		if (process.argv[2] === '--calculate-stats') {
			console.log('Calculating card stats, this will take some time...');
			writeToFile('card-odds', JSON.stringify(getCardDPT(), null, 2), 'json');
			writeToFile('card-probabilities', JSON.stringify(getCardProbabilities(), null, 2), 'json');
		} else {
			console.log('Skipping stats calculation. Pass --calculate-stats to re-calculate card stats.');
		}

		const generateRootDocs = await loadGenerateRootDocs();
		await generateRootDocs(writeToFile);
	})
	.then(() => {
		console.log('Done!');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Build failed:', err);
		console.error('Try `pnpm run build:docs` from the repository root.');
		process.exit(1);
	});
