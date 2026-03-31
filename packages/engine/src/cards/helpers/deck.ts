import { BattleFocusCard } from '../battle-focus.js';
import { BlastCard } from '../blast.js';
import { BlinkCard } from '../blink.js';
import { CoilCard } from '../coil.js';
import { DelayedHit } from '../delayed-hit.js';
import { FleeCard } from '../flee.js';
import { HealCard } from '../heal.js';
import { HitCard } from '../hit.js';
import { HornGore } from '../horn-gore.js';
import { SandstormCard } from '../sandstorm.js';
import { DEFAULT_MINIMUM_CARDS } from './constants.js';
import { draw } from './draw.js';

export const getMinimumDeck = (): any[] => [
	new BlinkCard(),
	new CoilCard(),
	new HornGore(),
	new BattleFocusCard(),
	new SandstormCard(),
	new BlastCard(),
	new HitCard(),
	new HitCard(),
	new HitCard(),
	new HitCard(),
	new DelayedHit(),
	new DelayedHit(),
	new HealCard(),
	new HealCard(),
	new FleeCard(),
];

export const fillDeck = (
	deck: any[],
	options: Record<string, unknown>,
	creature?: any
): any[] => {
	while (deck.length < DEFAULT_MINIMUM_CARDS) {
		deck.push(draw(options, creature));
	}
	return deck;
};

export const getInitialDeck = (
	options: Record<string, unknown>,
	creature?: any
): any[] => fillDeck(getMinimumDeck(), options, creature);
