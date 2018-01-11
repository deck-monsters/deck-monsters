const { getCardChoices, getFinalCardChoices } = require('../../helpers/choices');
const getArray = require('../../helpers/get-array');

const getCardCounts = require('./card-counts');

const cardChoiceQuestion = ({ cardChoices }) => `Choose one or more of the following cards:

${cardChoices}`;

const cardChoiceResult = ({ selectedCards }) => {
	if (selectedCards.length <= 0) {
		return 'You selected no cards.';
	} else if (selectedCards.length === 1) {
		return `You selected a ${selectedCards[0].cardType.toLowerCase()} card.`;
	}

	return `You selected the following cards:

${getFinalCardChoices(selectedCards)}`;
};

module.exports = ({
	cards,
	channel,
	getQuestion = cardChoiceQuestion,
	getResult = cardChoiceResult
}) => {
	const cardCatalog = getCardCounts(cards);
	const cardChoices = getCardChoices(cardCatalog);

	return Promise
		.resolve()
		.then(() => channel({
			question: getQuestion({ cardChoices })
		}))
		.then((answer) => {
			let selectedCardIndexes = getArray(answer);
			if (!Array.isArray(selectedCardIndexes)) selectedCardIndexes = [selectedCardIndexes];

			const remainingCards = [...cards];
			const selectedCards = selectedCardIndexes.reduce((selection, index) => {
				const cardType = Object.keys(cardCatalog)[index - 0];
				const cardIndex = remainingCards.findIndex(potentialCard => potentialCard.cardType === cardType);

				if (cardIndex >= 0) {
					const selectedCard = remainingCards.splice(cardIndex, 1)[0];
					selection.push(selectedCard);
				} else {
					throw new Error('The card could not be found.');
				}

				return selection;
			}, []);

			return channel({
				announce: getResult({ selectedCards })
			})
				.then(() => selectedCards);
		});
};
