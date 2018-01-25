const { getFinalItemChoices } = require('../../helpers/choices');
const { sortItemsAlphabetically } = require('./sort');
const chooseItems = require('./choose');

module.exports = ({ from, to, itemSelection, channel }) => {
	if (to.inEncounter) {
		return Promise.reject(channel({
			announce: `You cannot give items to ${to.givenName} while they are fighting!`
		}));
	}

	if (from.inEncounter) {
		return Promise.reject(channel({
			announce: `You cannot remove items from ${from.givenName} while they are fighting!`
		}));
	}

	return Promise.resolve()
		.then(() => {
			const items = sortItemsAlphabetically(from.items.filter(item => to.canHoldItem(item)));

			if (items.length < 1) {
				return Promise.reject(channel({
					announce: `${from.givenName} doesn't have any items that ${to.givenName} can use.`
				}));
			}

			if (itemSelection) {
				return itemSelection.reduce((selectedItems, itemType) => {
					const itemIndex = items.findIndex(potentialItem => potentialItem.itemType.toLowerCase() === itemType.toLowerCase()); // eslint-disable-line max-len

					if (itemIndex >= 0) {
						const selectedItem = items.splice(itemIndex, 1)[0];
						selectedItems.push(selectedItem);
					} else {
						channel({
							announce: `${to.givenName} can not hold ${itemType.toLowerCase()}`
						});
					}

					return selectedItems;
				}, []);
			}

			const { itemSlots } = to;
			const currentItemCount = to.items.length;
			const remainingSlots = itemSlots - currentItemCount;

			if (remainingSlots < 1) {
				return Promise.reject(channel({
					announce: `${to.givenName} doesn't have space for any more items!`
				}));
			}

			let currentItemDescription;
			if (currentItemCount === 0) {
				currentItemDescription = 'no items';
			} else if (currentItemCount === 1) {
				currentItemDescription = 'one item';
			} else {
				currentItemDescription = `${currentItemCount} items`;
			}

			const getQuestion = ({ itemChoices }) =>
				(`${to.givenName} is holding ${currentItemDescription} and has space for ${remainingSlots} more:

${itemChoices}

Which item(s) should ${from.givenName} give ${to.pronouns.him}?`);

			return chooseItems({
				items,
				channel,
				getQuestion
			})
				.then((selectedItems) => {
					const trimmedItems = selectedItems.slice(0, remainingSlots);

					const itemStr = trimmedItems.length === 1 ? 'item' : 'items';
					let message;
					if (trimmedItems.length < selectedItems.length) {
						message = `${to.givenName} has run out of space, but ${from.givenName} has given ${to.pronouns.him} the following ${itemStr}`; // eslint-disable-line max-len
					} else {
						message = `${from.givenName} has given ${to.givenName} the following ${itemStr}`;
					}

					return channel({
						announce:
`${message}:

${getFinalItemChoices(trimmedItems)}`
					})
						.then(() => trimmedItems.forEach(item => from.giveItem(item, to)));
				});
		});
};
