module.exports = (card1, card2) => card1.name === card2.name && JSON.stringify(card1) === JSON.stringify(card2);
