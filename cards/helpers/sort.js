const { sort } = require('../../helpers/sort');

const sortCardsAlphabetically = toBeSorted => sort(toBeSorted, 'cardType');

module.exports = {
	sortCardsAlphabetically
};
