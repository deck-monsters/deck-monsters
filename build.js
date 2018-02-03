const fs = require('fs-extra');

const cardCatalogue = require('./card-catalogue');
const dungeonMasterGuide = require('./dungeon-master-guide');
const getCardDPT = require('./helpers/card-odds');
const getCardProbabilities = require('./helpers/card-probabilities');
const monsterManual = require('./monster-manual');

const writeMarkdown = (name, string) => fs.writeFileSync(`${name.toUpperCase()}.md`, string);

Promise.resolve()
	// .then(() => {
	// 	fs.outputJsonSync('card-odds.json', getCardDPT());
	// 	fs.outputJsonSync('card-probabilities.json', getCardProbabilities());
	// })
	.then(() => {
		const content = [];
		return dungeonMasterGuide({ output: section => content.push(section) })
			.then(() => writeMarkdown('DMG', content.join('\n')));
	})
	.then(() => {
		const content = [];
		return cardCatalogue({ output: section => content.push(section) })
			.then(() => writeMarkdown('CARDS', content.join('\n')));
	})
	.then(() => {
		const content = [];
		return monsterManual({ output: section => content.push(section) })
			.then(() => writeMarkdown('MONSTERS', content.join('\n')));
	})
	.then(() => {
		process.exit(0);
	});
