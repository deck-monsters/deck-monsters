/* eslint-disable max-len */
const random = require('lodash.random');

const BaseScroll = require('./base');

const { ABUNDANT } = require('../../helpers/probabilities');
const { ALMOST_NOTHING } = require('../../helpers/costs');

const getTicketNumbers = () => [random(0, 99), random(0, 99), random(0, 99), random(0, 99), random(0, 99)];
const getWinnings = (matches, cost) => Math.round(Math.pow(10, (0.5 * matches)) * cost);

class LotteryTicket extends BaseScroll {
	constructor ({
		icon = '💰'
	} = {}) {
		super({ icon });
	}

	action (character) {
		const characterNumbers = getTicketNumbers();
		const winningNumbers = getTicketNumbers();

		const matches = characterNumbers.reduce((numberOfMatches, number, currentIndex) => (winningNumbers[currentIndex] === number ? numberOfMatches + 1 || 1 : numberOfMatches), 0);

		this.emit('narration', {
			narration: `🤞 ${character.givenName} holds a ticket imprinted with the numbers "${characterNumbers.join('" "')}".`
		});

		if (matches > 0) {
			const winnings = getWinnings(matches, this.cost);

			this.emit('narration', {
				narration: `Clutching ${character.pronouns.his} ticket in sweaty palms, ${character.pronouns.he} eagerly watches as the winning numbers are finally revealed...

"${winningNumbers.join('" "')}"

🍾 ${character.givenName} can't believe ${character.pronouns.his} eyes! ${matches > 1 ? `${matches} matches` : 'A match'}! ${character.pronouns.he} has won ${winnings} coins!`
			});


			character.coins += winnings;

			this.emit('narration', {
				narration: `The lottery agent hands ${character.givenName} a heavy sack containing ${winnings} coins, bringing ${character.pronouns.his} current wealth up to ${character.coins} coins.`
			});
		} else {
			this.emit('narration', {
				narration: `With anticipation building, ${character.pronouns.he} eagerly watches as the winning numbers are finally revealed...

"${winningNumbers.join('" "')}"

😔 ${character.givenName} can't believe ${character.pronouns.his} eyes. Not a single match. Better luck next time, ${character.givenName}.`
			});
		}
	}
}

LotteryTicket.itemType = 'Lottery Ticket';
LotteryTicket.probability = ABUNDANT.probability;
LotteryTicket.numberOfUses = 1;
LotteryTicket.level = 0;
LotteryTicket.cost = ALMOST_NOTHING.cost;
LotteryTicket.description = `Play the odds for a chance to win up to ${getWinnings(5, LotteryTicket.cost)} coins.`;
LotteryTicket.usableWithoutMonster = true;

module.exports = LotteryTicket;
