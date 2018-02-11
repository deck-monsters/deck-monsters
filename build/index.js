/* eslint-disable no-console */

const fs = require('fs-extra');

const cardCatalogue = require('./card-catalogue');
const cardCatalogueAsHTML = require('./card-catalogue-as-html');
const dungeonMasterGuide = require('./dungeon-master-guide');
const getCardDPT = require('./card-odds');
const getCardProbabilities = require('./card-probabilities');
const monsterManual = require('./monster-manual');
const playerHandbook = require('./player-handbook');

const writeToFile = (name, string, suffix = 'md') => fs.writeFileSync(`${name}.${suffix}`, string);

Promise.resolve()
	.then(() => {
		if (process.argv[2] === '--calculate-stats') {
			console.log('Calculating card stats, this will take some time...');
			fs.outputJsonSync('card-odds.json', getCardDPT());
			fs.outputJsonSync('card-probabilities.json', getCardProbabilities());
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
		process.exit(0);
	});
