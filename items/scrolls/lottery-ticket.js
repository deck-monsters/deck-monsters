/* eslint-disable max-len */
const random = require('lodash.random');

const BaseScroll = require('./base');

const { ABUNDANT } = require('../../helpers/probabilities');
const { ALMOST_NOTHING } = require('../../helpers/costs');

class LotteryTicket extends BaseScroll {
	constructor ({
		icon = '💰'
	} = {}) {
		super({ icon });
	}

	action (character) {
		const ticketNumber = random(1000, 1999);

		this.emit('narration', {
			narration: `🤞 ${character.givenName} holds a ticket imprinted with the numbers "${ticketNumber}".`
		});

		const winningNumber = random(1000, 1999);

		if (ticketNumber === winningNumber) {
			this.emit('narration', {
				narration: `Clutching ${character.pronouns.his} ticket in sweaty palms, ${character.pronouns.he} eagerly watches as the winning number is finally revealed...

"${winningNumber}"

🍾 ${character.givenName} can't believe ${character.pronouns.his} eyes! ${character.pronouns.he} has won!`
			});

			const winnings = random(100, 2000);

			character.coins += winnings;

			this.emit('narration', {
				narration: `The lottery agent hands ${character.givenName} a heavy sack containing ${winnings} coins, bringing ${character.pronouns.his} current wealth up to ${character.coins} coins.`
			});
		} else {
			this.emit('narration', {
				narration: `With anticipation building, ${character.pronouns.he} eagerly watches as the winning number is finally revealed...

"${winningNumber}"

😔 Better luck next time, ${character.givenName}.`
			});
		}
	}
}

LotteryTicket.itemType = 'Lottery Ticket';
LotteryTicket.probability = ABUNDANT.probability;
LotteryTicket.numberOfUses = 1;
LotteryTicket.description = 'Play the odds for a chance to win up to 2000 coins.';
LotteryTicket.level = 0;
LotteryTicket.cost = ALMOST_NOTHING.cost;
LotteryTicket.usableWithoutMonster = true;

module.exports = LotteryTicket;
