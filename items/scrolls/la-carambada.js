/* eslint-disable max-len */

const TargetingScroll = require('./targeting');
const { TARGET_MAX_HP_PLAYER } = require('../../helpers/targeting-strategies');

class LaCarambadaScroll extends TargetingScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🐍'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `${monster.givenName} will target whichever living opponent would have the highest hp if they were at full health (that is, the highest maximum hp), unless directed otherwise by a specific card.`;
	}
}

LaCarambadaScroll.itemType = 'The Ballad of La Carambada';
LaCarambadaScroll.description = `Junto a ellos, aterrorizó la comarca, aguardando el día de la venganza. Hizo fama por su diestro manejo de la pistola, del machete y, sobre todo, por su extraordinaria habilidad para cabalgar. En tiempos en que las mujeres acompañaban a sus hombres a un lado del caballo, ver a una mujer galopando era un acontecimiento mayor.

Target whoever has the highest maximum hp in the ring (other than yourself) even if they currently have less hp.`;
LaCarambadaScroll.targetingStrategy = TARGET_MAX_HP_PLAYER;

module.exports = LaCarambadaScroll;
