const fs = require('fs-extra');

const cardCatalogue = require('./card-catalogue');
const cardCatalogueAsHTML = require('./card-catalogue-as-html');
const dungeonMasterGuide = require('./dungeon-master-guide');
const getCardDPT = require('./helpers/card-odds');
const getCardProbabilities = require('./helpers/card-probabilities');
const monsterManual = require('./monster-manual');
const playerHandbook = require('./player-handbook');

const writeToFile = (name, string, suffix = 'md') => fs.writeFileSync(`${name}.${suffix}`, string);

Promise.resolve()
	// .then(() => {
	// 	fs.outputJsonSync('card-odds.json', getCardDPT());
	// 	fs.outputJsonSync('card-probabilities.json', getCardProbabilities());
	// })
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
