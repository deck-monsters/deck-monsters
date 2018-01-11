const { getFinalCardChoices } = require('../../helpers/choices');
const chooseItems = require('../../items/helpers/choose');

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
}) => chooseItems({
	items: cards,
	channel,
	getQuestion: ({ itemChoices }) => getQuestion({ cardChoices: itemChoices }),
	getResult: ({ selectedItems }) => getResult({ selectedCards: selectedItems })
});
