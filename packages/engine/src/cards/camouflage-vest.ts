import { CloakOfInvisibilityCard } from './cloak-of-invisibility.js';
import { BARBARIAN, FIGHTER } from '../constants/creature-classes.js';

export class CamouflageVestCard extends CloakOfInvisibilityCard {
	// Blending in is physical, and Fighters and Barbarians run low on int (owner, 2026-10-14).
	static override hideStat: 'int' | 'dex' = 'dex';
}

CamouflageVestCard.cardType = 'Camouflage Vest';
(CamouflageVestCard as any).permittedClassesAndTypes = [BARBARIAN, FIGHTER];
(CamouflageVestCard as any).description =
	'You don your vest and blend in, if only for a while.';
(CamouflageVestCard as any).notForSale = true;

export default CamouflageVestCard;
