import { LaCarambadaScroll } from './la-carambada.js';
import { TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS, getStrategyDescription } from '../../helpers/targeting-strategies.js';
import { ALMOST_NOTHING } from '../../helpers/costs.js';

export class LaCarambadaAccordingToCleverHansScroll extends LaCarambadaScroll {
	static itemType: string;
	static targetingStrategy: string;
	static description: string;
	static cost: number;
	static notForSale: boolean;

	constructor({ icon = '👦' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `Clever ${monster.givenName}'s mother told ${monster.pronouns.him} that ${monster.pronouns.he} should target whichever living monster would have the highest hp if they were at full health (that is, the highest maximum hp), unless directed otherwise by a specific card, and that's exactly what ${monster.pronouns.he}'ll do.`;
	}
}

LaCarambadaAccordingToCleverHansScroll.notForSale = true;
LaCarambadaAccordingToCleverHansScroll.cost = ALMOST_NOTHING.cost;
LaCarambadaAccordingToCleverHansScroll.itemType = 'The Ballad of La Carambada According to Clever Hans';
LaCarambadaAccordingToCleverHansScroll.targetingStrategy = TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS;
LaCarambadaAccordingToCleverHansScroll.description = `Junto a ellos, aterrorizó la comarca, aguardando el día de la venganza. Hizo fama por su diestro manejo de la pistola, del machete y, sobre todo, por su extraordinaria habilidad para cabalgar. En tiempos en que las mujeres acompañaban a sus hombres a un lado del caballo, ver a una mujer galopando era un acontecimiento mayor.\n\n${getStrategyDescription(LaCarambadaAccordingToCleverHansScroll.targetingStrategy)}`;

export default LaCarambadaAccordingToCleverHansScroll;
