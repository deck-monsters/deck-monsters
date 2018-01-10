const shuffle = require('lodash.shuffle');

const { getCardChoices, getFinalCardChoices } = require('../helpers/choices');
const getArray = require('../helpers/get-array');

const isProbable = require('../helpers/is-probable');
const BasicShieldCard = require('./basic-shield');
const BattleFocusCard = require('./battle-focus');
const BerserkCard = require('./berserk');
const BlastCard = require('./blast');
const BlinkCard = require('./blink');
const BoostCard = require('./boost');
const BrainDrainCard = require('./brain-drain');
const CamouflageVestCard = require('./camouflage-vest');
const CloakOfInvisibilityCard = require('./cloak-of-invisibility');
const CoilCard = require('./coil');
const ConstrictCard = require('./constrict');
const CurseCard = require('./curse');
const EnchantedFaceswapCard = require('./enchanted-faceswap');
const EnthrallCard = require('./enthrall');
const EntranceCard = require('./entrance');
const FightOrFlightCard = require('./fight-or-flight');
const FistsOfVillainyCard = require('./fists-of-villainy');
const FistsOfVirtueCard = require('./fists-of-virtue');
const ForkedMetalRodCard = require('./forked-metal-rod');
const ForkedStickCard = require('./forked-stick');
const FleeCard = require('./flee');
const HealCard = require('./heal');
const HitCard = require('./hit');
const HitHarderCard = require('./hit-harder');
const HornGoreCard = require('./horn-gore');
const KalevalaCard = require('./kalevala');
const PickPocketCard = require('./pick-pocket');
const LuckyStrike = require('./lucky-strike');
const MesmerizeCard = require('./mesmerize');
const PoundCard = require('./pound');
const RandomCard = require('./random');
const RehitCard = require('./rehit');
const ScotchCard = require('./scotch');
const ThickSkinCard = require('./thick-skin');
const VenegefulRampageCard = require('./vengeful-rampage');
const WhiskeyShotCard = require('./whiskey-shot');
const WoodenSpearCard = require('./wooden-spear');
// const ReviveCard = require('./revive');

const DEFAULT_MINIMUM_CARDS = 14;

const all = [
	BasicShieldCard,
	BattleFocusCard,
	BerserkCard,
	BlastCard,
	BlinkCard,
	BoostCard,
	BrainDrainCard,
	CamouflageVestCard,
	CloakOfInvisibilityCard,
	CoilCard,
	ConstrictCard,
	CurseCard,
	EnchantedFaceswapCard,
	EnthrallCard,
	EntranceCard,
	FightOrFlightCard,
	FistsOfVillainyCard,
	FistsOfVirtueCard,
	FleeCard,
	ForkedMetalRodCard,
	ForkedStickCard,
	HealCard,
	HitCard,
	HitHarderCard,
	HornGoreCard,
	KalevalaCard,
	PickPocketCard,
	LuckyStrike,
	MesmerizeCard,
	PoundCard,
	RandomCard,
	RehitCard,
	ScotchCard,
	ThickSkinCard,
	VenegefulRampageCard,
	WhiskeyShotCard,
	WoodenSpearCard
];

const getMinimumDeck = () => [
	new BlinkCard(),
	new CoilCard(),
	new HornGoreCard(),
	new BattleFocusCard(),
	new BlastCard(),
	new HitCard(),
	new HitCard(),
	new HitCard(),
	new HitCard(),
	new HealCard(),
	new HealCard(),
	new FleeCard()
];

const draw = (options, creature) => {
	let deck = shuffle(all);

	if (creature) {
		deck = deck.filter(card => creature.canHoldCard(card));
	}

	const Card = deck.find(isProbable);

	if (!Card) return draw(options, creature);

	// In the future we may want to pass some options to the cards,
	// but we need to make sure that we only pass card-related options.
	// For example, the level is not meant to passed to the card.
	return new Card(options);
};

// fills deck up with random cards appropriate for player's level
const fillDeck = (deck, options, creature) => {
	while (deck.length < DEFAULT_MINIMUM_CARDS) {
		deck.push(draw(options, creature));
	}

	return deck;
};

const getInitialDeck = (options, creature) => fillDeck(getMinimumDeck(), options, creature);

const isMatchingCard = (card1, card2) => card1.name === card2.name && JSON.stringify(card1) === JSON.stringify(card2);

const getCardCounts = (cards, maxReportableCopies = 9999) =>
	cards.reduce((cardCounts, card) => {
		cardCounts[card.cardType] = cardCounts[card.cardType] || 0;
		cardCounts[card.cardType] = Math.min(maxReportableCopies, cardCounts[card.cardType] + 1);
		return cardCounts;
	}, {});

const sortCards = cards => cards.sort((a, b) => {
	if (a.cardType > b.cardType) {
		return 1;
	}

	if (a.cardType < b.cardType) {
		return -1;
	}

	return 0;
});

const getUniqueCards = cards =>
	cards.reduce(
		(uniqueCards, card) =>
			uniqueCards.concat(!uniqueCards.find(possibleCard =>
				possibleCard.name === card.name) ? [card] : [])
		, []
	);

const hydrateCard = (cardObj, monster, deck = []) => {
	const existingCard = deck.find(card => isMatchingCard(card, cardObj)); // restore cards from the players deck if possible
	if (existingCard) return existingCard;

	const Card = all.find(({ name }) => name === cardObj.name);
	if (Card) return new Card(cardObj.options);

	return draw({}, monster);
};

const hydrateDeck = (deckJSON = [], monster) => {
	let deck = typeof deckJSON === 'string' ? JSON.parse(deckJSON) : deckJSON;
	deck = deck.map(cardObj => hydrateCard(cardObj, monster));

	const minimumDeck = getMinimumDeck();
	const minimumDeckCardCounts = getCardCounts(minimumDeck);
	const deckCardCounts = getCardCounts(deck);

	Object.keys(minimumDeckCardCounts).forEach((expectedCardType) => {
		for (let i = deckCardCounts[expectedCardType] || 0; i < minimumDeckCardCounts[expectedCardType]; i++) {
			const card = minimumDeck.find(({ cardType }) => cardType === expectedCardType);
			if (card) deck.push(card);
		}
	});

	return deck;
};

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

const chooseCards = ({
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

module.exports = {
	all,
	chooseCards,
	draw,
	fillDeck,
	getCardCounts,
	getInitialDeck,
	getMinimumDeck,
	getUniqueCards,
	hydrateCard,
	hydrateDeck,
	isMatchingCard,
	sortCards
};
