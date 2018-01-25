const { chooseCards, sortCardsAlphabetically } = require('../../cards');
const { getFinalCardChoices } = require('../../helpers/choices');

const MAX_CARD_COPIES_IN_HAND = 4;

module.exports = ({ deck, monster, cardSelection, channel }) => {
	const cards = [];
	const { cardSlots } = monster;

	const checkEncounter = (arg) => {
		if (monster.inEncounter) {
			return Promise.reject(channel({
				announce: `You cannot equip ${monster.givenName} while they are fighting!`
			}));
		}

		return Promise.resolve(arg);
	};

	const addCard = ({ remainingSlots, remainingCards }) => Promise
		.resolve()
		.then(checkEncounter)
		.then(() => {
			const equipableCards = remainingCards.reduce((equipable, card) => {
				const alreadyChosenNumber = cards.filter(chosen => chosen.name === card.name).length;
				const alreadyAddedNumber = equipable.filter(added => added.name === card.name).length;

				if ((alreadyChosenNumber + alreadyAddedNumber) < MAX_CARD_COPIES_IN_HAND) {
					equipable.push(card);
				}

				return equipable;
			}, []);

			const getQuestion = ({ cardChoices }) =>
				(`You have ${remainingSlots} of ${cardSlots} slots remaining, and the following cards:

${cardChoices}

Which card(s) would you like to equip next?`);

			return chooseCards({
				cards: equipableCards,
				channel,
				getQuestion
			});
		})
		.then((selectedCards) => {
			const trimmedCards = selectedCards.slice(0, remainingSlots);
			const nowRemainingSlots = remainingSlots - trimmedCards.length;
			const nowRemainingCards = remainingCards.filter(card => !trimmedCards.includes(card));

			cards.push(...trimmedCards);

			if (trimmedCards.length < selectedCards.length) {
				return channel({
					announce:
`You've run out of slots, but you've equiped the following cards:

${getFinalCardChoices(cards)}`
				})
					.then(() => cards);
			}

			if (nowRemainingSlots <= 0) {
				return channel({
					announce:
`You've filled your slots with the following cards:

${getFinalCardChoices(cards)}`
				})
					.then(() => cards);
			}

			if (nowRemainingCards.length <= 0) {
				return channel({
					announce:
`You're out of cards to equip, but you've equiped the following cards:

${getFinalCardChoices(cards)}`
				})
					.then(() => cards);
			}

			return addCard({ remainingSlots: nowRemainingSlots, remainingCards: nowRemainingCards });
		});

	return Promise
		.resolve()
		.then(checkEncounter)
		.then(() => {
			if (cardSlots <= 0) {
				return Promise.reject(channel({
					announce: 'You have no card slots available!'
				}));
			}

			if (deck.length <= 0) {
				return Promise.reject(channel({
					announce: 'Your deck is empty!'
				}));
			}

			const nowRemainingCards = sortCardsAlphabetically(deck.filter(card => monster.canHoldCard(card)));

			if (cardSelection) {
				cardSelection.forEach((card) => {
					if (cardSlots - cards.length > 0) {
						const cardIndex = nowRemainingCards.findIndex(potentialCard => potentialCard.cardType.toLowerCase() === card.toLowerCase()); // eslint-disable-line max-len

						if (cardIndex >= 0) {
							const selectedCard = nowRemainingCards.splice(cardIndex, 1)[0];
							cards.push(selectedCard);
						} else {
							channel({
								announce: `${monster.givenName} can not hold ${card.toLowerCase()}`
							});
						}
					}
				});
			}

			const nowRemainingSlots = cardSlots - cards.length;
			if (nowRemainingSlots <= 0) {
				return channel({
					announce:
`You've filled your slots with the following cards:

${getFinalCardChoices(cards)}`
				})
					.then(() => cards);
			}

			return addCard({ remainingSlots: nowRemainingSlots, remainingCards: nowRemainingCards });
		})
		.then(checkEncounter);
};
