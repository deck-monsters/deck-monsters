import { BaseScroll } from './base.js';
import { ABUNDANT } from '../../helpers/probabilities.js';
import { FREE } from '../../helpers/costs.js';
import { resolveChoiceIndex } from '../../helpers/choices.js';
import { announceAndThrow } from '../../helpers/announce-and-throw.js';
import type { ChannelFn } from '../../creatures/base.js';
import * as teams from '../../constants/teams.js';

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
		let givenName: string;
		let teamChoices: string[];

		if (monster) {
			givenName = monster['givenName'] as string;
			teamChoices = (Object.values(teams) as string[]).filter(team => team !== (monster['team'] as string));
		} else {
			givenName = character['givenName'] as string;
			teamChoices = (Object.values(teams) as string[]).filter(team => team !== (character['team'] as string));
		}

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

				const publicNarration = `${givenName} joins the ${team} team.`;
				const privateNarration = `"Is that so? Well if you're sure... better be ${team.toUpperCase()}!"

And just like that the ${this.itemType} is gone and ${publicNarration}`;

				if (monster) {
					monster.team = team;
				} else {
					character.team = team;
				}

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
SortingHat.description = `This enchanted hat that once belonged to Godric Gryffindor. Put it on and find out where you truly belong.\n\nIf your character has joined a team but your monster hasn't, that monster will be on your character's team by default.`;
SortingHat.level = 0;
SortingHat.cost = FREE.cost;
SortingHat.usableWithoutMonster = true;

export default SortingHat;
