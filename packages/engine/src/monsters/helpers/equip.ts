import type BaseMonster from '../base.js';
import type { ChannelFn, CardInstance } from '../../creatures/base.js';
import { getItemKey } from '../../items/helpers/counts.js';
import { matchesCardLookupName } from '../../cards/helpers/matches-lookup-name.js';
import { announceAndThrow } from '../../helpers/announce-and-throw.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// Lazy-load cards helpers to break circular dependency
let _chooseCards: AnyFn = () => Promise.resolve([]);
let _sortCardsAlphabetically: (cards: CardInstance[]) => CardInstance[] = cards => cards;
let _getFinalCardChoices: (cards: CardInstance[]) => string = () => '';

const loadHelpers = async () => {
	const [cardsModule, choicesModule] = await Promise.all([
		import('../../cards/helpers/choose.js').catch(() => null),
		import('../../helpers/choices.js').catch(() => null),
	]);

	const sortModule = await import('../../cards/helpers/sort.js').catch(() => null);

	if (cardsModule) {
		_chooseCards =
			(cardsModule as any).chooseCards ?? (cardsModule as any).default ?? _chooseCards;
	}
	if (sortModule) {
		_sortCardsAlphabetically =
			(sortModule as any).sortCardsAlphabetically ??
			(sortModule as any).default ??
			_sortCardsAlphabetically;
	}
	if (choicesModule) {
		_getFinalCardChoices =
			(choicesModule as any).getFinalCardChoices ??
			(choicesModule as any).getFinalItemChoices ??
			_getFinalCardChoices;
	}
};

export const equipHelpersReady = loadHelpers().catch((err) => {
	console.error('[engine] equipHelpersReady FAILED — equip helpers will be stubs:', err);
});

const MAX_CARD_COPIES_IN_HAND = 4;
const FINISH_EQUIPPING = Symbol('finish-equipping');
const isFinishAnswer = (answer: unknown): boolean =>
	/^(done|finished|enough|stop)$/i.test(String(answer ?? '').trim());

interface EquipOptions {
	deck: CardInstance[];
	monster: BaseMonster;
	cardSelection?: string[];
	channel: ChannelFn;
}

const equipMonster = ({ deck, monster, cardSelection, channel }: EquipOptions): Promise<CardInstance[]> => {
	const cards: CardInstance[] = [];
	const { cardSlots } = monster;

	const checkEncounter = (arg?: unknown) => {
		if (monster.inEncounter) {
			return announceAndThrow(channel, `You cannot equip ${monster.givenName} while they are fighting!`);
		}
		return Promise.resolve(arg);
	};

	const addCard = ({
		remainingSlots,
		remainingCards,
		selectedCards,
	}: {
		remainingSlots: number;
		remainingCards: CardInstance[];
		selectedCards?: CardInstance[];
	}): Promise<CardInstance[]> =>
		Promise.resolve()
			.then(checkEncounter)
			.then(() => {
				if (selectedCards) return selectedCards;

				const equipableCards = remainingCards.reduce(
					(equipable: CardInstance[], card: CardInstance) => {
						const cardKey = getItemKey(card);
						const alreadyChosenNumber = cards.filter(
							chosen => getItemKey(chosen) === cardKey,
						).length;
						const alreadyAddedNumber = equipable.filter(
							added => getItemKey(added) === cardKey,
						).length;

						if (alreadyChosenNumber + alreadyAddedNumber < MAX_CARD_COPIES_IN_HAND) {
							equipable.push(card);
						}

						return equipable;
					},
					[],
				);

				const getQuestion = ({ cardChoices }: { cardChoices: string }) => {
					const base =
						`You have ${remainingSlots} of ${cardSlots} slots remaining, and the following cards:\n\n${cardChoices}\n\nWhich card(s) would you like to equip next?`;
					// After a partial batch, offer an explicit finish path (text: "done"; web shows a Done button).
					if (cards.length > 0) {
						return `${base} (or reply "done" to finish with what you have)`;
					}
					return base;
				};

				// Finish is flow control, not an empty card selection. Reject with an
				// internal sentinel so chooseCards never emits its empty-result announce.
				const channelForChoose: ChannelFn = (opts) => {
					if (!opts.question) return channel(opts);
					return Promise.resolve(channel(opts)).then((answer) => {
						if (cards.length > 0 && isFinishAnswer(answer)) {
							throw FINISH_EQUIPPING;
						}
						return answer as string;
					});
				};

				return _chooseCards({
					cards: equipableCards,
					channel: channelForChoose,
					getQuestion,
				}).catch((err: unknown) => {
					if (err === FINISH_EQUIPPING) return [];
					throw err;
				});
			})
			.then((result: CardInstance[]) => {
				const trimmedCards = result.slice(0, remainingSlots);
				const nowRemainingSlots = remainingSlots - trimmedCards.length;
				const nowRemainingCards = remainingCards.filter(card => !trimmedCards.includes(card));

				cards.push(...trimmedCards);

				if (trimmedCards.length < result.length) {
					return (channel({
						announce: `You've run out of slots, but you've equiped the following cards:\n\n${_getFinalCardChoices(cards)}`,
					}) as Promise<unknown>).then(() => cards);
				}

				if (nowRemainingSlots <= 0) {
					return (channel({
						announce: `You've filled your slots with the following cards:\n\n${_getFinalCardChoices(cards)}`,
					}) as Promise<unknown>).then(() => cards);
				}

				if (nowRemainingCards.length <= 0) {
					return (channel({
						announce: `You're out of cards to equip, but you've equiped the following cards:\n\n${_getFinalCardChoices(cards)}`,
					}) as Promise<unknown>).then(() => cards);
				}

				// An empty continuation remains an intentional partial-batch finish;
				// cancellation rejects earlier and therefore leaves monster.cards unchanged.
				if (trimmedCards.length === 0 && cards.length > 0) {
					return (channel({
						announce: `You've equiped the following cards:\n\n${_getFinalCardChoices(cards)}`,
					}) as Promise<unknown>).then(() => cards);
				}

				return addCard({
					remainingSlots: nowRemainingSlots,
					remainingCards: nowRemainingCards,
				});
			});

	return Promise.resolve()
		.then(checkEncounter)
		.then(() => {
			if (cardSlots <= 0) {
				return announceAndThrow(channel, 'You have no card slots available!');
			}

			if (deck.length <= 0) {
				return announceAndThrow(channel, 'Your deck is empty!');
			}

			const nowRemainingCards = _sortCardsAlphabetically(
				deck.filter(card => monster.canHoldCard(card)),
			);
			const nowRemainingSlots = cardSlots - cards.length;

			let selectedCards: CardInstance[] | undefined;
			const selectionMessages: string[] = [];
			if (cardSelection) {
				const remainingItems = [...nowRemainingCards];
				selectedCards = cardSelection.reduce((selection: CardInstance[], cardType: string) => {
					const wanted = cardType.trim().toLowerCase();
					const cardIndex = remainingItems.findIndex(
						(potential: CardInstance) => matchesCardLookupName(potential, wanted),
					);

					if (cardIndex >= 0) {
						const selectedCard = remainingItems[cardIndex];
						const alreadySelected = selection.filter(
							card => getItemKey(card) === getItemKey(selectedCard),
						).length;

						if (alreadySelected >= MAX_CARD_COPIES_IN_HAND) {
							selectionMessages.push(`You may not equip more than ${MAX_CARD_COPIES_IN_HAND} copies of ${cardType.trim()}.`);
						} else {
							remainingItems.splice(cardIndex, 1);
							selection.push(selectedCard);
						}
					} else {
						selectionMessages.push(`${monster.givenName} can not hold ${cardType.trim().toLowerCase()}`);
					}

					return selection;
				}, []);
			}

			return Promise.resolve()
				.then(() => (selectionMessages.length > 0
					? channel({ announce: selectionMessages.join('\n') })
					: undefined))
				.then(() => addCard({ remainingSlots: nowRemainingSlots, remainingCards: nowRemainingCards, selectedCards }));
		})
		.then(checkEncounter)
		.then(() => {
			monster.cards = cards;
			return cards;
		}) as Promise<CardInstance[]>;
};

export { equipMonster };
export default equipMonster;
