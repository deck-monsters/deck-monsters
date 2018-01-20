/* eslint-disable max-len */

const LaCarambadaScroll = require('./la-carambada');
const { TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');

class LaCarambadaAccordingToCleverHansScroll extends LaCarambadaScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👦'
	} = {}) {
		super({ icon });
	}
}

LaCarambadaAccordingToCleverHansScroll.probability = 75;
LaCarambadaAccordingToCleverHansScroll.cost = 18;
LaCarambadaAccordingToCleverHansScroll.itemType = 'The Ballad of La Carambada According to Clever Hans';
LaCarambadaAccordingToCleverHansScroll.description = `Junto a ellos, aterrorizó la comarca, aguardando el día de la venganza. Hizo fama por su diestro manejo de la pistola, del machete y, sobre todo, por su extraordinaria habilidad para cabalgar. En tiempos en que las mujeres acompañaban a sus hombres a un lado del caballo, ver a una mujer galopando era un acontecimiento mayor.

Target whoever has the highest maximum hp in the ring even if they currently have less hp.`;
LaCarambadaAccordingToCleverHansScroll.targetingStrategy = TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS;

module.exports = LaCarambadaAccordingToCleverHansScroll;
