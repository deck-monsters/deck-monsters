const { INVISIBILITY_EFFECT } = require('../constants/effect-types');

module.exports = monster => !!monster.encounterEffects.find(encounterEffect => encounterEffect.effectType === INVISIBILITY_EFFECT);
