/* eslint-disable max-len */

const LaCarambadaScroll = require('./la-carambada');
const { TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');

class LaCarambadaAccordingToCleverHansScroll extends LaCarambadaScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👦'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `Clever ${monster.givenName}'s mother told ${monster.pronouns.him} that ${monster.pronouns.he} should target whichever living monster would have the highest hp if they were at full health (that is, the highest maximum hp), unless directed otherwise by a specific card, and that's exactly what ${monster.pronouns.he}'ll do.`;
	}
}

LaCarambadaAccordingToCleverHansScroll.notForSale = true;
LaCarambadaAccordingToCleverHansScroll.cost = ALMOST_NOTHING;
LaCarambadaAccordingToCleverHansScroll.itemType = 'The Ballad of La Carambada According to Clever Hans';
LaCarambadaAccordingToCleverHansScroll.description = `Junto a ellos, aterrorizó la comarca, aguardando el día de la venganza. Hizo fama por su diestro manejo de la pistola, del machete y, sobre todo, por su extraordinaria habilidad para cabalgar. En tiempos en que las mujeres acompañaban a sus hombres a un lado del caballo, ver a una mujer galopando era un acontecimiento mayor.

Your mother told you to target whoever has the highest maximum hp in the ring even if they currently have less hp, and that's exactly what you'll do.`;
LaCarambadaAccordingToCleverHansScroll.targetingStrategy = TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS;

module.exports = LaCarambadaAccordingToCleverHansScroll;
