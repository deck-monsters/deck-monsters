import { TargetingScroll } from './targeting.js';
import { TARGET_MAX_HP_PLAYER, getStrategyDescription } from '../../helpers/targeting-strategies.js';

export class LaCarambadaScroll extends TargetingScroll {
	static itemType: string;
	static targetingStrategy: string;
	static description: string;

	constructor({ icon = '💃' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `${monster.givenName} will target whichever living opponent would have the highest hp if they were at full health (that is, the highest maximum hp), unless directed otherwise by a specific card.`;
	}
}

LaCarambadaScroll.itemType = 'The Ballad of La Carambada';
LaCarambadaScroll.targetingStrategy = TARGET_MAX_HP_PLAYER;
LaCarambadaScroll.description = `Junto a ellos, aterrorizó la comarca, aguardando el día de la venganza. Hizo fama por su diestro manejo de la pistola, del machete y, sobre todo, por su extraordinaria habilidad para cabalgar. En tiempos en que las mujeres acompañaban a sus hombres a un lado del caballo, ver a una mujer galopando era un acontecimiento mayor.\n\n${getStrategyDescription(LaCarambadaScroll.targetingStrategy)}`;

export default LaCarambadaScroll;
