function FleeCard () {
	// Do something in the constructor
}

FleeCard.name = 'Flee';
FleeCard.probability = 40;
FleeCard.effect = (player, target, game) => { // eslint-disable-line no-unused-vars
	// TO-DO: fill this in with more complete and realistic actions
	player.leaveCombat();
};

module.exports = FleeCard;
