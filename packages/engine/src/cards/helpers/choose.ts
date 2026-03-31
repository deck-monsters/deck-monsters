import {
	getFinalItemChoices as getFinalCardChoices,
	getItemChoices as getCardChoices,
} from '../../helpers/choices.js';
import chooseItems from '../../items/helpers/choose.js';

const cardChoiceQuestion = ({
	cardChoices,
}: {
	cardChoices: string;
}): string =>
	`Choose one or more of the following cards:\n\n${cardChoices}`;

const cardChoiceResult = ({
	selectedCards,
}: {
	selectedCards: Array<{ cardType: string }>;
}): string => {
	if (selectedCards.length <= 0) {
		return 'You selected no cards.';
	} else if (selectedCards.length === 1) {
		return `You selected a ${selectedCards[0].cardType.toLowerCase()} card.`;
	}

	return `You selected the following cards:\n\n${getFinalCardChoices(
		selectedCards as any
	)}`;
};

interface ChooseCardsOptions {
	cards: any[];
	channel: any;
	showPrice?: boolean;
	priceOffset?: number;
	getQuestion?: (opts: { cardChoices: string }) => string;
	getResult?: (opts: { selectedCards: any[] }) => string;
}

const chooseCards = ({
	cards,
	channel,
	showPrice,
	priceOffset,
	getQuestion = cardChoiceQuestion,
	getResult = cardChoiceResult,
}: ChooseCardsOptions): Promise<any> =>
	(chooseItems as any)({
		items: cards,
		channel,
		showPrice,
		priceOffset,
		getQuestion: ({ itemChoices }: { itemChoices: string }) =>
			getQuestion({ cardChoices: itemChoices }),
		getResult: ({ selectedItems }: { selectedItems: any[] }) =>
			getResult({ selectedCards: selectedItems }),
	});

export default chooseCards;
export { chooseCards };
