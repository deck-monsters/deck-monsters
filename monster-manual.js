/* eslint-disable class-methods-use-this, max-len */
const Promise = require('bluebird');

const { monsterCard } = require('./helpers/card');


const allMonsters = require('./monsters/helpers/all.js');

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
		.then(output(header))
		.then(() => Promise.each(allMonsters, Monster => output(monsterCard(new Monster(), true))));
};

const monsterManual = ({ channel, output }) => {
	let format;

	if (channel) {
		const { channelManager, channelName } = channel;
		format = announce => Promise.resolve()
			.then(() => channelManager.queueMessage({
				announce,
				channel,
				channelName
			}));

		return generateMonsterManual(format).then(() => channelManager.sendMessages());
	} else if (output) {
		format = string => Promise.resolve().then(() => output(string));
	} else {
		format = string => Promise.resolve().then(() => console.log(string)); // eslint-disable-line no-console
	}

	return generateMonsterManual(format);
};

module.exports = monsterManual;
