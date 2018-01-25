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

	get ticketNumbers () {
		return [random(0, this.cost/2), random(0, this.cost), random(0, this.cost), random(0, this.cost), random(0, this.cost * 10)]
	}

	action (character) {
		let ticketNumbers = this.ticketNumbers;
		let winningNumbers = this.ticketNumbers;

		let matches = ticketNumbers.reduce((matches, number, currentIndex) => winningNumbers[currentIndex] === number ? matches + 1 || 1 : matches, 0);

		this.emit('narration', {
			narration: `🤞 ${character.givenName} holds a ticket imprinted with the numbers "${ticketNumbers.join(', ')}".`
		});

		if (matches > 0) {
			const winnings = [
				0,
				this.cost/2,
				this.cost,
				this.cost + 1,
				random(this.cost + 2, this.cost * 3),
				random(this.cost * 10, this.cost * 200)
			];

			this.emit('narration', {
				narration: `Clutching ${character.pronouns.his} ticket in sweaty palms, ${character.pronouns.he} eagerly watches as the winning numbers are finally revealed...

"${winningNumbers.join(', ')}"

🍾 ${character.givenName} can't believe ${character.pronouns.his} eyes! ${matches} matche${matches > 1 ? 's' : ''}! ${character.pronouns.he} has won ${winnings[matches]} coins!`
			});



			character.coins += winnings[matches];

			this.emit('narration', {
				narration: `The lottery agent hands ${character.givenName} a heavy sack containing ${winnings[matches]} coins, bringing ${character.pronouns.his} current wealth up to ${character.coins} coins.`
			});
		} else {
			this.emit('narration', {
				narration: `With anticipation building, ${character.pronouns.he} eagerly watches as the winning numbers are finally revealed...

"${winningNumbers.join(', ')}"

😔 ${character.givenName} can't believe ${character.pronouns.his} eyes. Not a single match. Better luck next time, ${character.givenName}.`
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
