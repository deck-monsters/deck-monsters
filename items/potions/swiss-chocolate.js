/* eslint-disable max-len */

const ChocolateBar = require('./chocolate-bar');

const { EPIC } = require('../../helpers/probabilities');

class SwissChocolate extends ChocolateBar {}

SwissChocolate.itemType = 'Swiss Chocolate';
SwissChocolate.healAmount = 10;
SwissChocolate.probability = EPIC.probability;
SwissChocolate.description = `Only the finest Swiss chocolate. Restores ${SwissChocolate.healAmount} hp.`;

module.exports = SwissChocolate;
