/* eslint-disable class-methods-use-this, max-len */

const BaseClass = require('./baseClass');

class PlayerHandbook extends BaseClass {
	look (channel) {
		return Promise
			.resolve()
			.then(() => channel({
				announce: `
\`\`\`
	 ____    ___
	/\\  _\`\\ /\\_ \\
	\\ \\ \\L\\ \\//\\ \\      __     __  __     __   _ __
	 \\ \\ ,__/ \\ \\ \\   /'__\`\\  /\\ \\/\\ \\  /'__\`\\/\\\`'__\\
	  \\ \\ \\/   \\_\\ \\_/\\ \\L\\.\\_\\ \\ \\_\\ \\/\\  __/\\ \\ \\/
	   \\ \\_\\   /\\____\\ \\__/.\\_\\\\/\`____ \\ \\____\\\\ \\_\\
	    \\/_/   \\/____/\\/__/\\/_/ \`/___/> \\/____/ \\/_/
	                               /\\___/
	                               \\/__/
	 __  __                       __  __                      __
	/\\ \\/\\ \\                     /\\ \\/\\ \\                    /\\ \\
	\\ \\ \\_\\ \\     __      ___    \\_\\ \\ \\ \\____    ___     ___\\ \\ \\/'\\
	 \\ \\  _  \\  /'__\`\\  /' _ \`\\  /'_\` \\ \\ '__\`\\  / __\`\\  / __\`\\ \\ , <
	  \\ \\ \\ \\ \\/\\ \\L\\.\\_/\\ \\/\\ \\/\\ \\L\\ \\ \\ \\L\\ \\/\\ \\L\\ \\/\\ \\L\\ \\ \\ \\\\\`\\
	   \\ \\_\\ \\_\\ \\__/.\\_\\ \\_\\ \\_\\ \\___,_\\ \\_,__/\\ \\____/\\ \\____/\\ \\_\\ \\_\\
	    \\/_/\\/_/\\/__/\\/_/\\/_/\\/_/\\/__,_ /\\/___/  \\/___/  \\/___/  \\/_/\\/_/



    Welcome to Deck Monsters, the monster capturing, deck-building, turn based RPG.

    In this game, you (the player) will capture monsters to fight for you. Use your card pool to build each monster's deck before you send it into battle.

    During battle, your monster will play each card one at a time in the order in which you placed it in the monster's deck. When the monster gets to the end of its deck, it starts back at the beginning of the deck again.

    Choose your cards wisely, good luck, and have fun!
\`\`\`
`
			}));
	}
}

PlayerHandbook.eventPrefix = 'playerHandbook';

module.exports = PlayerHandbook;
