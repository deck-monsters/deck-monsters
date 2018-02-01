/* eslint-disable class-methods-use-this, max-len */
const Promise = require('bluebird');

const { monsterCard } = require('./helpers/card');

const BaseClass = require('./shared/baseClass');

const allMonsters = require('./monsters/helpers/all.js');
const monsterList = allMonsters.reduce((list, Monster) => list + `${new Monster().creatureType}\n\t\t`, '');


const monsterManual = (channel) => {
	const { channelManager, channelName } = channel;

	const header = `\`\`\`

 ███▄ ▄███▓ ▒█████   ███▄    █   ██████ ▄▄▄█████▓▓█████  ██▀███      ███▄ ▄███▓ ▄▄▄       ███▄    █  █    ██  ▄▄▄       ██▓
▓██▒▀█▀ ██▒▒██▒  ██▒ ██ ▀█   █ ▒██    ▒ ▓  ██▒ ▓▒▓█   ▀ ▓██ ▒ ██▒   ▓██▒▀█▀ ██▒▒████▄     ██ ▀█   █  ██  ▓██▒▒████▄    ▓██▒
▓██    ▓██░▒██░  ██▒▓██  ▀█ ██▒░ ▓██▄   ▒ ▓██░ ▒░▒███   ▓██ ░▄█ ▒   ▓██    ▓██░▒██  ▀█▄  ▓██  ▀█ ██▒▓██  ▒██░▒██  ▀█▄  ▒██░
▒██    ▒██ ▒██   ██░▓██▒  ▐▌██▒  ▒   ██▒░ ▓██▓ ░ ▒▓█  ▄ ▒██▀▀█▄     ▒██    ▒██ ░██▄▄▄▄██ ▓██▒  ▐▌██▒▓▓█  ░██░░██▄▄▄▄██ ▒██░
▒██▒   ░██▒░ ████▓▒░▒██░   ▓██░▒██████▒▒  ▒██▒ ░ ░▒████▒░██▓ ▒██▒   ▒██▒   ░██▒ ▓█   ▓██▒▒██░   ▓██░▒▒█████▓  ▓█   ▓██▒░██████▒
░ ▒░   ░  ░░ ▒░▒░▒░ ░ ▒░   ▒ ▒ ▒ ▒▓▒ ▒ ░  ▒ ░░   ░░ ▒░ ░░ ▒▓ ░▒▓░   ░ ▒░   ░  ░ ▒▒   ▓▒█░░ ▒░   ▒ ▒ ░▒▓▒ ▒ ▒  ▒▒   ▓▒█░░ ▒░▓  ░
░  ░      ░  ░ ▒ ▒░ ░ ░░   ░ ▒░░ ░▒  ░ ░    ░     ░ ░  ░  ░▒ ░ ▒░   ░  ░      ░  ▒   ▒▒ ░░ ░░   ░ ▒░░░▒░ ░ ░   ▒   ▒▒ ░░ ░ ▒  ░
░      ░   ░ ░ ░ ▒     ░   ░ ░ ░  ░  ░    ░         ░     ░░   ░    ░      ░     ░   ▒      ░   ░ ░  ░░░ ░ ░   ░   ▒     ░ ░
       ░       ░ ░           ░       ░              ░  ░   ░               ░         ░  ░         ░    ░           ░  ░    ░  ░

	There are ${allMonsters.length} different types of monsters:

		${monsterList}


	Here are some sample beginner level monsters:
\`\`\``;

	return Promise.resolve()
		.then(() => channelManager.queueMessage({
			announce: header,
			channel,
			channelName
		}))
		.then(() => Promise.each(allMonsters, Monster => channelManager.queueMessage({
			announce: monsterCard(new Monster(), true),
			channel,
			channelName
		})))
		.then(() => channelManager.sendMessages());

}

module.exports = monsterManual;
