import { BaseScroll } from './base.js';
import { ABUNDANT } from '../../helpers/probabilities.js';
import { FREE } from '../../helpers/costs.js';
import { resolveChoiceIndex } from '../../helpers/choices.js';
import { announceAndThrow } from '../../helpers/announce-and-throw.js';
import type { ChannelFn } from '../../creatures/base.js';
import * as teams from '../../constants/teams.js';

/** The hat's choice for leaving a team. */
export const NO_TEAM = 'No team';

export class SortingHat extends BaseScroll {
	static itemType: string;
	static probability: number;
	static numberOfUses: number;
	static description: string;
	static level: number;
	static cost: number;
	static usableWithoutMonster: boolean;
	static requiresPrompt: boolean;

	constructor({ icon = '🎩' }: { icon?: string } = {}) {
		super({ icon });
	}

	action({ channel, channelName, character, monster }: {
		channel: ChannelFn;
		channelName?: string;
		character: Record<string, unknown>;
		monster?: Record<string, unknown>;
	}): Promise<string> {
		const wearer = monster ?? character;
		const givenName = wearer['givenName'] as string;
		const ownTeam = wearer['team'] as string | undefined;
		// A monster with no team of its own fights on its Beastmaster's (teamOf falls back to
		// the character), so that is the house it is in.
		const inheritedTeam = monster ? (character['team'] as string | undefined) : undefined;
		const currentTeam = ownTeam ?? inheritedTeam;
		// The hat used to offer only the other houses, so nobody could ever leave a team. It
		// now offers "No team" where choosing it leaves the wearer teamless. Clearing a
		// monster's own team while its Beastmaster has one only drops it back to that team, so
		// the hat does not offer it there; `leave team` clears both, for free. A Codex review
		// of #403 found the hat offering an inherited house again with no way out.
		const canLeave = !!ownTeam && !inheritedTeam;
		const teamChoices = [
			...(Object.values(teams) as string[]).filter(team => team !== currentTeam),
			...(canLeave ? [NO_TEAM] : []),
		];

		return Promise
			.resolve()
			.then(() => channel({
				question:
`"Hmm," says a small voice in ${givenName}'s ear. "Difficult. Very difficult. Plenty of courage, I see. Not a bad mind either. There's talent, oh my goodness, yes — and a nice thirst to prove yourself, now that's interesting. . . . So where shall I put you?"`,
				choices: teamChoices
			}))
			.then((answer: unknown) => {
				// The Discord connector answers with the button's label text, never an index
				// (see docs/reference/prompt-answer-contract.md). `teamChoices[Number(answer)]` used to
				// return `undefined` for a Discord answer, and the very next line's
				// `team.toUpperCase()` threw a TypeError — resolve either form and fail loudly
				// instead.
				const index = resolveChoiceIndex(answer, teamChoices);
				const team = teamChoices[index];
				if (!team) {
					return announceAndThrow(channel, `I don't recognize "${String(answer)}" as a team.`);
				}

				const leaving = team === NO_TEAM;
				const publicNarration = leaving
					? `${givenName} leaves the ${currentTeam} team.`
					: `${givenName} joins the ${team} team.`;
				const privateNarration = leaving
					? `"No house at all? How very independent of you."

And just like that the ${this.itemType} is gone and ${publicNarration}`
					: `"Is that so? Well if you're sure... better be ${team.toUpperCase()}!"

And just like that the ${this.itemType} is gone and ${publicNarration}`;

				wearer.team = leaving ? undefined : team;

				this.emit('narration', {
					channel,
					channelName,
					narration: privateNarration
				});

				this.emit('narration', {
					narration: publicNarration
				});

				return team;
			});
	}
}

// `action` asks which team, so this one cannot be used through a prompt-free channel.
SortingHat.requiresPrompt = true;
SortingHat.itemType = 'Sorting Hat';
SortingHat.probability = ABUNDANT.probability;
SortingHat.numberOfUses = 1;
SortingHat.description = `This enchanted hat that once belonged to Godric Gryffindor. Put it on and find out where you truly belong, or choose no team at all.\n\nIf your character has joined a team but your monster hasn't, that monster will be on your character's team by default. Every shop keeps one in stock, and \`leave team\` takes you and your monsters off a team for free.`;
SortingHat.level = 0;
SortingHat.cost = FREE.cost;
SortingHat.usableWithoutMonster = true;

export default SortingHat;
