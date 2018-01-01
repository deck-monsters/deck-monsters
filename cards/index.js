const shuffle = require('lodash.shuffle');

const isProbable = require('../helpers/is-probable');
const BasicShieldCard = require('./basic-shield');
const BlastCard = require('./blast');
const BoostCard = require('./boost');
const BrainDrainCard = require('./brain-drain');
const CamouflageVestCard = require('./camouflage-vest');
const CloakOfInvisibilityCard = require('./cloak-of-invisibility');
const CoilCard = require('./constrict');
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

const DEFAULT_MINIMUM_CARDS = 10;

const all = [
	BasicShieldCard,
	BlastCard,
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

const getInitialDeck = (options, creature) => {
	// See above re: options
	const deck = [
		new HitCard(),
		new HitCard(),
		new HitCard(),
		new HitCard(),
		new HealCard(),
		new HealCard(),
		new FleeCard()
	];

	const beginnerSpecials = [
		new CoilCard(),
		new BlastCard(),
		new HornGoreCard(),
		new BerserkCard()
	];

	deck.push(beginnerSpecials[Math.random() * beginnerSpecials.length]);

	return fillDeck(deck, options, creature);
};

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
	const existingCard = deck.find(card => card.name === cardObj.name && JSON.stringify(card) === JSON.stringify(cardObj)); // restore cards from the players deck if possible
	if (existingCard) return existingCard;

	const Card = all.find(({ name }) => name === cardObj.name);
	if (Card) return new Card(cardObj.options);

	return draw({}, monster);
};

const hydrateDeck = (deckJSON, monster) => JSON
	.parse(deckJSON)
	.map(cardObj => hydrateCard(cardObj, monster));

module.exports = {
	all,
	draw,
	fillDeck,
	getCardCounts,
	getInitialDeck,
	getUniqueCards,
	hydrateCard,
	hydrateDeck,
	sortCards
};
