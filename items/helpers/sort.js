const { sort } = require('../../helpers/sort');

const sortItemsAlphabetically = toBeSorted => sort(toBeSorted, 'itemType');

module.exports = {
	sortItemsAlphabetically
};
