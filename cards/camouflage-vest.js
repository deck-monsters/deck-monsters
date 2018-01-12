/* eslint-disable max-len */

const CloakOfInvisibilityCard = require('./cloak-of-invisibility');

const { BARBARIAN, FIGHTER } = require('../helpers/classes');

class CamouflageVestCard extends CloakOfInvisibilityCard {}

CamouflageVestCard.cardType = 'Camouflage Vest';
CamouflageVestCard.permittedClassesAndTypes = [BARBARIAN, FIGHTER];
CamouflageVestCard.description = 'You don your vest and blend in, if only for a while.';

module.exports = CamouflageVestCard;
