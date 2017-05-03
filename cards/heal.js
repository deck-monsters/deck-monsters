function HealCard () {
	// Do something in the constructor
}

HealCard.name = 'Heal';
HealCard.probability = 60;
HealCard.effect = (player, target, game) => { // eslint-disable-line no-unused-vars
	// TO-DO: fill this in with more complete and realistic actions
	player.heal(1);
};

module.exports = HealCard;
