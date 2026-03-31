import { INVISIBILITY_EFFECT } from '../constants/effect-types.js';

interface EncounterEffect {
	effectType: string;
}

interface MonsterWithEffects {
	encounterEffects: EncounterEffect[];
}

const isInvisible = (monster: MonsterWithEffects): boolean =>
	!!monster.encounterEffects.find(
		encounterEffect => encounterEffect.effectType === INVISIBILITY_EFFECT
	);

export default isInvisible;
export { isInvisible };
