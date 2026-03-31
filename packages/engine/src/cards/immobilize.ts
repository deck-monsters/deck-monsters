import { HitCard } from './hit.js';
import { chance } from '../helpers/chance.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { capitalize } from '../helpers/capitalize.js';
import { FREE } from '../helpers/costs.js';
import { GLADIATOR, MINOTAUR, WEEPING_ANGEL } from '../constants/creature-types.js';
import { IMPOSSIBLE } from '../helpers/probabilities.js';
import { signedNumber } from '../helpers/signed-number.js';

const { roll } = chance;

export class ImmobilizeCard extends HitCard {
	static cardType = 'Immobilize';
	static actions = {
		IMMOBILIZE: 'immobilize',
		IMMOBILIZES: 'immobilizes',
		IMMOBILIZED: 'immobilized',
	};
	static strongAgainstCreatureTypes = [GLADIATOR];
	static weakAgainstCreatureTypes = [MINOTAUR];
	static uselessAgainstCreatureTypes = [WEEPING_ANGEL];
	static probability = IMPOSSIBLE.probability;
	static description = 'Immobilize your adversary.';
	static level = 1;
	static cost = FREE.cost;
	static defaults = {
		...HitCard.defaults,
		doDamageOnImmobilize: false,
		freedomSavingThrowTargetAttr: 'ac',
		freedomThresholdModifier: 2,
		ongoingDamage: 0,
		targetProp: 'dex',
	};
	static flavors = {
		hits: [['stuns', 100]],
	};

	constructor({
		doDamageOnImmobilize,
		icon = '😵',
		freedomSavingThrowTargetAttr,
		freedomThresholdModifier,
		ongoingDamage,
		targetProp,
		...rest
	}: Record<string, any> = {}) {
		super({ icon, targetProp, ...rest } as any);
		this.setOptions({
			doDamageOnImmobilize,
			freedomSavingThrowTargetAttr,
			freedomThresholdModifier,
			ongoingDamage,
			targetProp,
		} as any);
	}

	get actions(): Record<string, string> {
		return (this.constructor as any).actions;
	}

	get doDamageOnImmobilize(): boolean {
		return (this.options as any).doDamageOnImmobilize;
	}

	get ongoingDamage(): number {
		return (this.options as any).ongoingDamage;
	}

	get strongAgainstCreatureTypes(): string[] {
		return (this.constructor as any).strongAgainstCreatureTypes;
	}

	get weakAgainstCreatureTypes(): string[] {
		return (this.constructor as any).weakAgainstCreatureTypes;
	}

	get uselessAgainstCreatureTypes(): string[] {
		return (this.constructor as any).uselessAgainstCreatureTypes;
	}

	override get stats(): string {
		let strModifiers = '';
		let strongBonus = 0;
		let weakBonus = 0;

		if (
			this.strongAgainstCreatureTypes.length &&
			this.getAttackModifier({ creatureType: this.strongAgainstCreatureTypes[0] })
		) {
			const strongAgainst = this.strongAgainstCreatureTypes.join(', ');
			strongBonus = signedNumber(
				this.getAttackModifier({ creatureType: this.strongAgainstCreatureTypes[0] })
			) as unknown as number;
			const sb = this.getAttackModifier({
				creatureType: this.strongAgainstCreatureTypes[0],
			});
			strModifiers += `${signedNumber(sb)} ${sb < 0 ? 'dis' : ''}advantage vs ${strongAgainst}\n`;
			strongBonus = sb;
		}

		if (
			this.weakAgainstCreatureTypes.length &&
			this.getAttackModifier({ creatureType: this.weakAgainstCreatureTypes[0] })
		) {
			const weakAgainst = this.weakAgainstCreatureTypes.join(', ');
			const wb = this.getAttackModifier({
				creatureType: this.weakAgainstCreatureTypes[0],
			});
			strModifiers += `${signedNumber(wb)} ${wb < 0 ? 'dis' : ''}advantage vs ${weakAgainst}\n`;
			weakBonus = wb;
		}

		if (this.uselessAgainstCreatureTypes.length) {
			const uselessAgainst = this.uselessAgainstCreatureTypes.join(', ');
			strModifiers += `inneffective against ${uselessAgainst}\n`;
		}

		const ongoingDamageText = this.ongoingDamage
			? `\n-${this.ongoingDamage} hp each turn immobilized.`
			: '';

		let advantageModifier = '+ advantage';
		if (strongBonus < 0 && weakBonus < 0) {
			advantageModifier = '- disadvantage';
		} else if (strongBonus >= 0 && weakBonus < 0) {
			advantageModifier = '+/- advantage/disadvantage';
		}

		return `If already immobilized, hit instead.
${super.stats}
${strModifiers}
Opponent breaks free by rolling 1d20 vs immobilizer's ${this.freedomSavingThrowTargetAttr} ${advantageModifier} - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.
${ongoingDamageText}`;
	}

	get freedomThresholdModifier(): number {
		return (this.options as any).freedomThresholdModifier;
	}

	set freedomThresholdModifier(v: number) {
		this.setOptions({ freedomThresholdModifier: v } as any);
	}

	get freedomSavingThrowTargetAttr(): string {
		return (this.options as any).freedomSavingThrowTargetAttr;
	}

	set freedomSavingThrowTargetAttr(v: string) {
		this.setOptions({ freedomSavingThrowTargetAttr: v } as any);
	}

	getFreedomThresholdBase(player: any): number {
		return player[this.freedomSavingThrowTargetAttr];
	}

	getFreedomThreshold(player: any, target: any): number {
		let fatigue = 0;
		if (target.encounterModifiers?.immobilizedTurns) {
			fatigue = target.encounterModifiers.immobilizedTurns * 3;
		}
		return Math.max(
			this.getFreedomThresholdBase(player) +
				this.getAttackModifier(target) -
				fatigue,
			1
		);
	}

	getAttackModifier(target: any): number {
		if (!target?.creatureType) return 0;
		if (this.weakAgainstCreatureTypes.includes(target.creatureType)) {
			return -this.freedomThresholdModifier;
		} else if (this.strongAgainstCreatureTypes.includes(target.creatureType)) {
			return this.freedomThresholdModifier;
		}
		return 0;
	}

	override getAttackRoll(player: any, target?: any): any {
		const statsBonus =
			this.targetProp === 'ac'
				? player.dexModifier
				: player[`${this.targetProp}Modifier`];
		return roll({
			primaryDice: this.attackDice,
			modifier: statsBonus + this.getAttackModifier(target),
			bonusDice: player.bonusAttackDice,
			crit: true,
		});
	}

	getImmobilizeRoll(immobilizer: any, immobilized?: any): any {
		const statsBonus =
			this.freedomSavingThrowTargetAttr === 'ac'
				? immobilizer.dexModifier
				: immobilizer[`${this.freedomSavingThrowTargetAttr}Modifier`];
		const attackModifier = immobilized
			? this.getAttackModifier(immobilized)
			: 0;
		return roll({
			primaryDice: this.attackDice,
			modifier: statsBonus + attackModifier,
			bonusDice: immobilizer.bonusAttackDice,
			crit: true,
		});
	}

	getFreedomRoll(_immobilizer: any, immobilized: any): any {
		const statsBonus =
			this.freedomSavingThrowTargetAttr === 'ac'
				? immobilized.dexModifier
				: immobilized[`${this.freedomSavingThrowTargetAttr}Modifier`];
		return roll({
			primaryDice: this.attackDice,
			modifier: statsBonus,
			bonusDice: immobilized.bonusAttackDice,
			crit: true,
		});
	}

	immobilizeCheck(
		_player: any,
		_target: any,
		_ring?: any,
		_activeContestants?: any
	): boolean {
		return true;
	}

	getImmobilizeEffect(player: any, target: any, ring: any, _activeContestants?: any): any {
		const immobilize = this;
		const ImmobilizeEffect = ({ card, phase }: any) => {
			if (phase === ATTACK_PHASE) {
				if (!player.dead) {
					this.emit('effect', {
						effectResult: `${this.icon} ${this.actions.IMMOBILIZED} by`,
						player,
						target,
						ring,
					});

					const freedomRoll = immobilize.getFreedomRoll(player, target);
					const freedomThreshold = this.getFreedomThreshold(player, target);
					const { success, strokeOfLuck, curseOfLoki, tie } =
						this.checkSuccess(freedomRoll, freedomThreshold);
					let commentary: string | undefined;

					if (strokeOfLuck) {
						commentary = `${target.givenName} rolled a natural 20 and violently breaks free from ${player.givenName}.`;
					} else if (curseOfLoki) {
						target.encounterModifiers.immobilizedTurns = 0;
						commentary = `${target.givenName} rolled a natural 1. ${player.givenName} improves ${player.pronouns.his} cruel hold on ${target.pronouns.him}`;
					} else if (tie) {
						commentary = 'Miss... Tie goes to the defender.';
					}

					this.emit('rolled', {
						reason: `and needs ${freedomThreshold + 1} or higher to break free.`,
						card: this,
						roll: freedomRoll,
						who: target,
						outcome: success
							? commentary || `Success! ${target.givenName} is freed.`
							: commentary ||
							  `${target.givenName} remains ${this.actions.IMMOBILIZED} and will miss a turn.`,
						vs: freedomThreshold,
					});

					if (success) {
						target.encounterEffects = target.encounterEffects.filter(
							(effect: any) => effect.effectType !== 'ImmobilizeEffect'
						);
						if (strokeOfLuck && target !== player) {
							player.hit(2, target, this);
						}
					} else {
						target.encounterModifiers.immobilizedTurns =
							(target.encounterModifiers.immobilizedTurns || 0) + 1;
						if (this.ongoingDamage > 0) {
							this.emit('narration', {
								narration: `${target.givenName} takes ongoing damage from being ${this.actions.IMMOBILIZED}`,
							});
							target.hit(this.ongoingDamage, player, this);
						}
						card.play = () => Promise.resolve(!target.dead);
					}
				} else {
					target.encounterEffects = target.encounterEffects.filter(
						(effect: any) => effect.effectType !== 'ImmobilizeEffect'
					);
					this.emit('narration', {
						narration: `${target.givenName} is no longer ${this.actions.IMMOBILIZED}. ${capitalize(target.pronouns.he)} pushes the limp dead body of ${player.givenName} off of ${target.pronouns.him}self and proudly stands prepared to fight`,
					});
				}
			}
			return card;
		};
		return ImmobilizeEffect;
	}

	freedomThresholdNarrative(player: any, target: any): string {
		const thresholdBonusText = this.getAttackModifier(target)
			? `${signedNumber(this.getAttackModifier(target))}`
			: '';
		const playerName =
			player === target
				? `${player.pronouns.his} own`
				: `${player.givenName}'s`;
		return `1d20 vs ${playerName} ${this.freedomSavingThrowTargetAttr}(${this.getFreedomThresholdBase(player)})${thresholdBonusText} -(immobilized turns x 3)`;
	}

	emitImmobilizeNarrative(player: any, target: any): void {
		const targetName =
			player === target ? `${player.pronouns.him}self` : target.givenName;
		let immobilizeNarrative = `\n${player.givenName} ${this.icon} ${this.actions.IMMOBILIZES} ${targetName}.\nAt the beginning of ${target.givenName}'s turn ${target.pronouns.he} will roll ${this.freedomThresholdNarrative(player, target)} to attempt to break free.`;
		if (this.ongoingDamage > 0) {
			immobilizeNarrative += `\n${target.givenName} takes ${this.ongoingDamage} damage per turn ${target.pronouns.he} is ${this.actions.IMMOBILIZED}\n`;
		}
		this.emit('narration', { narration: immobilizeNarrative });
	}

	immobilize(
		player: any,
		target: any,
		ring: any,
		activeContestants: any
	): any {
		const alreadyImmobilized = !!target.encounterEffects.find(
			(effect: any) => effect.effectType === 'ImmobilizeEffect'
		);
		const canHaveEffect = !this.uselessAgainstCreatureTypes.includes(
			target.creatureType
		);

		if (alreadyImmobilized || !canHaveEffect) {
			let narration = '';
			if (alreadyImmobilized) {
				narration = `\n${target.givenName} is already immobilized, ${player.givenName} _shows no mercy_!`;
			} else {
				narration = `\n${target.givenName} laughs haughtily as ${player.givenName} tries to ${this.actions.IMMOBILIZE} them, ${player.pronouns.he} vents ${player.pronouns.his} fury at ${target.pronouns.his} mockery!`;
			}
			this.emit('narration', { narration });
			return super.effect(player, target, ring, activeContestants);
		}

		const immobilizeSuccess = this.immobilizeCheck(
			player,
			target,
			ring,
			activeContestants
		);
		if (immobilizeSuccess) {
			this.emitImmobilizeNarrative(player, target);
			const immobilizeEffect = this.getImmobilizeEffect(
				player,
				target,
				ring,
				activeContestants
			);
			immobilizeEffect.effectType = 'ImmobilizeEffect';
			target.encounterEffects = [...target.encounterEffects, immobilizeEffect];
			target.encounterModifiers.immobilizedTurns = 0;

			if (this.doDamageOnImmobilize) {
				return super.effect(player, target, ring, activeContestants);
			}
			return !target.dead;
		}

		return !target.dead;
	}

	override effect(player: any, target: any, ring: any, activeContestants?: any): any {
		return this.immobilize(player, target, ring, activeContestants);
	}
}

export default ImmobilizeCard;
