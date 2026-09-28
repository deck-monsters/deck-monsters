/**
 * Layer 3 of the balance methodology (roadmap 34): which cards a real monster can hold at a
 * level, read from the engine's own `canHoldCard` on a real instance, so the harness never
 * restates the class and type permissions.
 */
import { allMonsters, getCardClassByTypeName, getXpCapForLevel, randomContestant } from '@deck-monsters/engine';
import { catalogueCards } from './catalogue.js';

interface HolderMonster {
	level: number;
	canHoldCard(card: unknown): boolean;
	disposeTimers(): void;
}
interface HolderCharacter {
	disposeTimers?(): void;
}

type MonsterClass = { name: string };

export function monsterClass(type: string): MonsterClass {
	const found = (allMonsters as unknown as MonsterClass[]).find(M => M.name === type);
	if (!found) throw new Error(`No monster class ${type}`);
	return found;
}

/** A real player's monster of `type` at `level` (dispose its timers when done). */
export function buildHolder(type: string, level: number): { monster: HolderMonster; character: HolderCharacter } {
	const contestant = randomContestant({ isBoss: false, Monsters: [monsterClass(type)], xp: getXpCapForLevel(level) } as never);
	return contestant as unknown as { monster: HolderMonster; character: HolderCharacter };
}

/** Catalogue card types (Flee aside) a monster of `type` can hold at `level`. */
export function holdableCardTypes(type: string, level: number): string[] {
	const { monster, character } = buildHolder(type, level);
	try {
		return catalogueCards()
			.filter(card => {
				const Card = getCardClassByTypeName(card.cardType) as unknown as new () => unknown;
				return monster.canHoldCard(new Card());
			})
			.map(card => card.cardType);
	} finally {
		monster.disposeTimers();
		character.disposeTimers?.();
	}
}
