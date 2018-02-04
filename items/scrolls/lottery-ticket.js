/* eslint-disable max-len */
const random = require('lodash.random');

const BaseScroll = require('./base');

const { ABUNDANT } = require('../../helpers/probabilities');
const { ALMOST_NOTHING } = require('../../helpers/costs');
const { capitalize } = require('../../helpers/capitalize');

const getTicketNumbers = () => [random(11, 99), random(11, 55), random(11, 99), random(11, 99), random(11, 99)];
const getWinnings = (matches, cost) => Math.round(Math.pow(10, (0.6 * matches)) * cost);

class LotteryTicket extends BaseScroll {
	constructor ({
		icon = '💰'
	} = {}) {
		super({ icon });
	}

	action ({ channel, channelName, character }) {
		return Promise.resolve()
			.then(() => {
				const characterNumbers = getTicketNumbers();
				const winningNumbers = getTicketNumbers();

				const matches = characterNumbers.reduce((numberOfMatches, number, currentIndex) => (winningNumbers[currentIndex] === number ? numberOfMatches + 1 || 1 : numberOfMatches), 0);

				this.emit('narration', {
					channel,
					channelName,
					narration: `🤞 ${character.givenName} holds a ticket imprinted with the numbers "${characterNumbers.join('" "')}".`
				});

				return Promise.resolve(channel)
					.then(({ channelManager } = {}) => channelManager && channelManager.sendMessages())
					.then(() => ({ winningNumbers, matches }));
			})
			.then(({ winningNumbers, matches }) => {
				if (matches > 0) {
					const winnings = getWinnings(matches, this.cost);
					character.coins += winnings;

					this.emit('narration', {
						channel,
						channelName,
						narration:
`Clutching ${character.pronouns.his} ticket in sweaty palms, ${character.pronouns.he} eagerly watches as the winning numbers are finally revealed...

"${winningNumbers.join('" "')}"

🍾 ${character.givenName} can't believe ${character.pronouns.his} eyes! ${matches > 1 ? `${matches} matches` : 'A match'}! ${capitalize(character.pronouns.he)} has won ${winnings} coins!

The lottery agent hands ${character.givenName} a heavy sack containing ${winnings} coins, bringing ${character.pronouns.his} current wealth up to ${character.coins} coins.`
					});

					// Also send a notification to everyone
					this.emit('narration', {
						narration: `🍾 ${character.givenName} just won ${winnings} coins in the lottery! Drinks on ${character.pronouns.him}.`
					});

					return true;
				}

				this.emit('narration', {
					channel,
					channelName,
					narration:
`With anticipation building, ${character.pronouns.he} eagerly watches as the winning numbers are finally revealed...

"${winningNumbers.join('" "')}"

😔 ${character.givenName} can't believe ${character.pronouns.his} eyes. Not a single match. Better luck next time, ${character.givenName}.`
				});

				return false;
			});
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
