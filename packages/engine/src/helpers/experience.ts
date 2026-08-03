import { describeLevels } from './levels.js';

export const BASE_XP_PER_KILL = 10;
export const BASE_XP_PER_KILLED_BY = 1;
export const BASE_XP_LAST_ONE_STANDING = 3;
export const XP_PER_VICTORY = 10;
export const XP_PER_DEFEAT = 1;
export const STARTING_XP = 0;
const BASE_XP_PER_FLEEING = 2;

export const xpFormula = (levelDifference: number, base: number): number =>
	Math.round(Math.pow(10, -0.3 * levelDifference) * base);

interface Monster {
	level: number;
	givenName?: string;
	displayLevel?: string;
	dead?: boolean;
	team?: string;
	pronouns?: { him: string };
}

interface Contestant {
	monster: Monster;
	character: { team?: string };
	killed?: Monster[];
	killedBy?: Monster;
	fled?: boolean;
	rounds?: number;
	/**
	 * Per-encounter team override set by a ring event (e.g. Common Cause, House War).
	 * Takes precedence over `monster.team` and `character.team` for XP opponent counting,
	 * so teammate-vs-opponent XP bonuses respect the event's faction assignments rather
	 * than persisted creature options. See docs/boss-encounters.md §5.
	 */
	team?: string;
}

export interface XPResult {
	gainedXP: number;
	reasons: string;
}

export const calculateXP = (contestant: Contestant, contestants: Contestant[]): XPResult => {
	let gainedXP = 0;
	const { monster } = contestant;
	const killed = contestant.killed || [];
	const rounds = contestant.rounds || 1;
	const reasonList: string[] = [];
	let xp: number;

	killed.forEach((opponentKilled) => {
		const { difference: levelDifference, description: levelDescription } = describeLevels(
			monster.level,
			opponentKilled.level
		);
		xp = xpFormula(levelDifference!, BASE_XP_PER_KILL);

		reasonList.push(
			`Gained ${xp > 0 ? xp : 'no'} XP for killing ${opponentKilled.givenName} (${levelDescription})`
		);

		gainedXP += xp;
	});

	if (contestant.killedBy) {
		if (contestant.killedBy !== contestant.monster) {
			const { difference: levelDifference, description: levelDescription } = describeLevels(
				monster.level,
				contestant.killedBy.level
			);
			xp = Math.min(
				xpFormula(levelDifference!, BASE_XP_PER_KILLED_BY),
				BASE_XP_PER_KILLED_BY * rounds
			);

			reasonList.push(
				`Gained ${xp > 0 ? xp : 'no'} XP for being killed by ${contestant.killedBy.givenName} (${levelDescription})`
			);

			gainedXP += xp;
		} else {
			reasonList.push(
				`Gained no XP for being killed by ${contestant.monster.pronouns?.him ?? 'it'}self`
			);
		}
	} else if (contestant.fled || !monster.dead) {
		const levels = [monster.level];
		const opponents: Contestant[] = [];
		contestants.forEach((opponent) => {
			if (opponent.monster !== monster) {
				levels.push(opponent.monster.level);
				opponents.push(opponent);
			}
		});

		const { description: levelDescription, difference: levelDifference } =
			describeLevels(...levels);

		const xpBase = contestant.fled ? BASE_XP_PER_FLEEING : BASE_XP_LAST_ONE_STANDING;
		xp = Math.min(xpFormula(levelDifference!, xpBase), xpBase * rounds);

		const forText = contestant.fled ? 'fleeing' : 'being the last one standing';

		let levelText: string;
		if (opponents.length > 1) {
			levelText = `${contestants.length - 1} opponents at an ${levelDescription}`;
		} else if (opponents.length === 1) {
			levelText = `${opponents[0].monster.givenName} (${levelDescription})`;
		} else {
			levelText = 'no remaining opponents';
		}

		reasonList.push(
			`Gained ${xp > 0 ? xp : 'no'} XP for ${forText} as a ${monster.displayLevel} monster lasting ${rounds} rounds in battle with ${levelText}`
		);

		gainedXP += xp;
	}

	let numOpponents = 0;
	if (contestants.length > 2) {
		// Contestant-level team override (from ring events like Common Cause/House War)
		// takes precedence over monster.team and character.team so that XP bonuses for
		// fighting across factions correctly reflect the event's team assignments rather
		// than persisted creature options. See docs/boss-encounters.md §5.
		const contestantTeam = contestant.team || monster.team || contestant.character.team;
		if (!contestantTeam) {
			numOpponents += contestants.length - 1;
		} else {
			numOpponents += contestants.reduce((result, opponent) => {
				if (opponent.monster === monster) return result; // skip self
				const opponentTeam = opponent.team || opponent.monster.team || opponent.character.team;

				if (contestantTeam !== opponentTeam) {
					return result + 1;
				}

				return result;
			}, 0);
		}
	}

	const opponentModifier = contestants.length - 1 + numOpponents;

	if (!contestant.monster.dead && !contestant.fled) {
		xp = opponentModifier;
	} else if (rounds > 2) {
		xp = Math.round(opponentModifier / 2);
	} else {
		xp = Math.round(opponentModifier / 4);
	}

	reasonList.push(
		`Gained ${xp > 0 ? xp : 'no'} XP for lasting ${rounds} rounds in battle against ${contestants.length - 1} opponent${contestants.length - 1 === 1 ? '' : 's'}`
	);
	gainedXP += xp;

	return { gainedXP, reasons: reasonList.join('\n') };
};
