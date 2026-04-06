import { BaseScroll } from './base.js';
import { ABUNDANT } from '../../helpers/probabilities.js';
import { FREE } from '../../helpers/costs.js';
import { getChoices } from '../../helpers/choices.js';
import * as teams from '../../constants/teams.js';

export class SortingHat extends BaseScroll {
	static itemType: string;
	static probability: number;
	static numberOfUses: number;
	static description: string;
	static level: number;
	static cost: number;
	static usableWithoutMonster: boolean;

	constructor({ icon = '🎩' }: { icon?: string } = {}) {
		super({ icon });
	}

	action({ channel, channelName, character, monster }: { channel: any; channelName?: string; character: any; monster?: any }): Promise<string> {
		let givenName: string;
		let teamChoices: string[];

		if (monster) {
			givenName = monster.givenName;
			teamChoices = Object.values(teams).filter((team: any) => team !== monster.team) as string[];
		} else {
			givenName = character.givenName;
			teamChoices = Object.values(teams).filter((team: any) => team !== character.team) as string[];
		}

		return Promise
			.resolve()
			.then(() => channel({
				question:
`"Hmm," says a small voice in ${givenName}'s ear. "Difficult. Very difficult. Plenty of courage, I see. Not a bad mind either. There's talent, oh my goodness, yes — and a nice thirst to prove yourself, now that's interesting. . . . So where shall I put you?"`,
				choices: teamChoices
			}))
			.then((answer: number | string) => {
				const team = teamChoices[Number(answer)];

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

SortingHat.itemType = 'Sorting Hat';
SortingHat.probability = ABUNDANT.probability;
SortingHat.numberOfUses = 1;
SortingHat.description = `This enchanted hat that once belonged to Godric Gryffindor. Put it on and find out where you truly belong.\n\nIf your character has joined a team but your monster hasn't, that monster will be on your character's team by default.`;
SortingHat.level = 0;
SortingHat.cost = FREE.cost;
SortingHat.usableWithoutMonster = true;

export default SortingHat;
