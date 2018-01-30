/* eslint-disable max-len, prefer-destructuring */

const BaseScroll = require('./base');

const { ABUNDANT } = require('../../helpers/probabilities');
const { FREE } = require('../../helpers/costs');
const { getChoices } = require('../../helpers/choices');
const teams = require('../../helpers/teams');

class SortingHat extends BaseScroll {
	constructor ({
		icon = '🎩'
	} = {}) {
		super({ icon });
	}

	action ({ channel, channelName, character, monster }) {
		let givenName;
		let teamChoices;
		if (monster) {
			givenName = monster.givenName;
			teamChoices = Object.values(teams).filter(team => team !== monster.team);
		} else {
			givenName = character.givenName;
			teamChoices = Object.values(teams).filter(team => team !== character.team);
		}

		return Promise
			.resolve()
			.then(() => channel({
				question:
`"Hmm," says a small voice in ${givenName}'s ear. "Difficult. Very difficult. Plenty of courage, I see. Not a bad mind either. There’s talent, oh my goodness, yes — and a nice thirst to prove yourself, now that’s interesting. . . . So where shall I put you?"

${getChoices(teamChoices)}`,
				choices: Object.keys(teamChoices)
			}))
			.then((answer) => {
				const team = teamChoices[answer];

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
SortingHat.description = `This enchanted hat that once belonged to Godric Gryffindor. Put it on and find out where you truly belong.

If your character has joined a team but your monster hasn't, that monster will be on your character's team by default.`;
SortingHat.level = 0;
SortingHat.cost = FREE.cost;
SortingHat.usableWithoutMonster = true;

module.exports = SortingHat;
