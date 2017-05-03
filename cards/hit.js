function HitCard () {
	// Do something in the constructor
}

HitCard.name = 'Hit';
HitCard.probability = 80;
HitCard.effect = (player, target, game) => { // eslint-disable-line no-unused-vars
	// TO-DO: fill this in with more complete and realistic actions
	target.hit(1);
};

module.exports = HitCard;
