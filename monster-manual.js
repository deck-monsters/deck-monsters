/* eslint-disable class-methods-use-this, max-len */
const Promise = require('bluebird');

const { monsterCard } = require('./helpers/card');
const allMonsters = require('./monsters/helpers/all.js');
const generateDocs = require('./helpers/generate-docs');

const monsterList = allMonsters.map(({ creatureType }) => creatureType);

const generateMonsterManual = (output) => {
	const header =
`
\`\`\`

 ███▄ ▄███▓ ▒█████   ███▄    █   ██████ ▄▄▄█████▓▓█████  ██▀███
▓██▒▀█▀ ██▒▒██▒  ██▒ ██ ▀█   █ ▒██    ▒ ▓  ██▒ ▓▒▓█   ▀ ▓██ ▒ ██▒
▓██    ▓██░▒██░  ██▒▓██  ▀█ ██▒░ ▓██▄   ▒ ▓██░ ▒░▒███   ▓██ ░▄█ ▒
▒██    ▒██ ▒██   ██░▓██▒  ▐▌██▒  ▒   ██▒░ ▓██▓ ░ ▒▓█  ▄ ▒██▀▀█▄
▒██▒   ░██▒░ ████▓▒░▒██░   ▓██░▒██████▒▒  ▒██▒ ░ ░▒████▒░██▓ ▒██▒
░ ▒░   ░  ░░ ▒░▒░▒░ ░ ▒░   ▒ ▒ ▒ ▒▓▒ ▒ ░  ▒ ░░   ░░ ▒░ ░░ ▒▓ ░▒▓░
░  ░      ░  ░ ▒ ▒░ ░ ░░   ░ ▒░░ ░▒  ░ ░    ░     ░ ░  ░  ░▒ ░ ▒░
░      ░   ░ ░ ░ ▒     ░   ░ ░ ░  ░  ░    ░         ░     ░░   ░
       ░       ░ ░           ░       ░              ░  ░   ░

    ███▄ ▄███▓ ▄▄▄       ███▄    █  █    ██  ▄▄▄       ██▓
   ▓██▒▀█▀ ██▒▒████▄     ██ ▀█   █  ██  ▓██▒▒████▄    ▓██▒
   ▓██    ▓██░▒██  ▀█▄  ▓██  ▀█ ██▒▓██  ▒██░▒██  ▀█▄  ▒██░
   ▒██    ▒██ ░██▄▄▄▄██ ▓██▒  ▐▌██▒▓▓█  ░██░░██▄▄▄▄██ ▒██░
   ▒██▒   ░██▒ ▓█   ▓██▒▒██░   ▓██░▒▒█████▓  ▓█   ▓██▒░██████▒
   ░ ▒░   ░  ░ ▒▒   ▓▒█░░ ▒░   ▒ ▒ ░▒▓▒ ▒ ▒  ▒▒   ▓▒█░░ ▒░▓  ░
   ░  ░      ░  ▒   ▒▒ ░░ ░░   ░ ▒░░░▒░ ░ ░   ▒   ▒▒ ░░ ░ ▒  ░
   ░      ░     ░   ▒      ░   ░ ░  ░░░ ░ ░   ░   ▒     ░ ░
          ░         ░  ░         ░    ░           ░  ░    ░  ░

There are ${allMonsters.length} different types of monsters:

${monsterList.join('\n')}

Here are some sample beginner level monsters:
\`\`\``;

	return Promise.resolve()
		.then(() => output(header))
		.then(() => Promise.each(allMonsters, Monster => output(monsterCard(new Monster(), true))));
};

const monsterManual = ({ channel, output }) => generateDocs({ channel, generate: generateMonsterManual, output });

module.exports = monsterManual;
