import { shuffle } from '../../helpers/random.js';
import { isProbable } from '../../helpers/is-probable.js';
import all from './all.js';

export const draw = (options: Record<string, unknown> = {}, creature?: any): any => {
	let deck = process.env.DECK_MONSTERS_DETERMINISTIC_DRAW
		? [...all].sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
		: shuffle([...all]);

	if (creature) {
		deck = deck.filter((Card: any) => creature.canHoldCard(Card));
	}

	const Card = deck.find((C: any) => isProbable({ probability: C.probability ?? 0 }));

	if (!Card) return draw(options, creature);

	return new Card(options);
};

export const cardDrawHelpers = { draw };

export default draw;
