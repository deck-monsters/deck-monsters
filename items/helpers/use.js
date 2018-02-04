/* eslint-disable max-len */
const Promise = require('bluebird');

const { sortItemsAlphabetically } = require('./sort');
const chooseItems = require('./choose');

module.exports = ({ channel, character, itemSelection, monster, use }) => Promise.resolve()
	.then(() => {
		let items;
		let targetStr;
		if (monster) {
			items = [...monster.items];

			if (!monster.inEncounter) {
				items = [...items, ...character.items.filter(item => monster.canUseItem(item))];
				targetStr = monster.givenName;
			} else {
				targetStr = `${monster.givenName} while ${monster.pronouns.he} is in an encounter`;
			}
		} else {
			items = character.items.filter(item => character.canUseItem(item));
			targetStr = `${character.pronouns.him}self`;
		}

		if (items.length < 1) {
			return Promise.reject(channel({
				announce: `${character.givenName} doesn't have any items that ${character.pronouns.he} can use on ${targetStr}.`
			}));
		}

		if (itemSelection && itemSelection.length > 0) {
			return itemSelection.reduce((selectedItems, itemType) => {
				const itemIndex = items.findIndex(potentialItem => potentialItem.itemType.toLowerCase() === itemType.toLowerCase());

				if (itemIndex >= 0) {
					const selectedItem = items.splice(itemIndex, 1)[0];
					selectedItems.push(selectedItem);
				} else {
					channel({
						announce: `${character.givenName} can not use ${itemType.toLowerCase()} on ${targetStr}.`
					});
				}

				return selectedItems;
			}, []);
		}

		items = sortItemsAlphabetically(items);

		const getQuestion = ({ itemChoices }) =>
			(`Which item should ${character.givenName} use on ${targetStr}?

${itemChoices}`);

		return chooseItems({
			items,
			channel,
			getQuestion
		});
	})
	.then(selectedItems => channel({
		question: 'Are you sure? (yes/no)'
	})
		.then((answer = '') => {
			if (answer.toLowerCase() === 'yes') {
				return selectedItems;
			}

			return Promise.reject(channel({ announce: 'You know what they always say, "An item saved is an item earned."' }));
		}))
	.then(selectedItems => Promise.mapSeries(selectedItems, item => use({ channel, isMonsterItem: !!monster || !item.usableWithoutMonster, item, monster })));
