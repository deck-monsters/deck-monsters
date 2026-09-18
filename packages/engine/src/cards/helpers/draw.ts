import { shuffle } from '../../helpers/random.js';
import { isProbable } from '../../helpers/is-probable.js';
import { earlyDropBoost } from '../../constants/progression.js';
import all from './all.js';

export const draw = (options: Record<string, unknown> = {}, creature?: any): any => {
	let deck = process.env.DECK_MONSTERS_DETERMINISTIC_DRAW
		? [...all].sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
		: shuffle([...all]);

	if (creature) {
		deck = deck.filter((Card: any) => creature.canHoldCard(Card));
	}

	// `creature.canHoldCard` above is the level gate (a monster/character can never draw
	// a card above its own level) — that gate is untouched. Within the pool it already
	// qualifies for, `earlyDropBoost` multiplies each card's rarity roll so a low-level
	// creature is more likely to walk away with the more interesting card of the ones
	// it's already allowed to hold. See constants/progression.ts for why.
	const boost = earlyDropBoost(typeof creature?.level === 'number' ? creature.level : 0);
	const Card = deck.find((C: any) =>
		isProbable({ probability: Math.min(100, (C.probability ?? 0) * boost) })
	);

	if (!Card) return draw(options, creature);

	return new Card(options);
};

export const cardDrawHelpers = { draw };

export default draw;
