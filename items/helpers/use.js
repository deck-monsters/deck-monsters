/* eslint-disable max-len */
const Promise = require('bluebird');

const { sortItemsAlphabetically } = require('./sort');
const chooseItems = require('./choose');

module.exports = ({ channel, character, monster, use }) => Promise.resolve()
	.then(() => {
		let items;
		let targetStr;
		if (monster) {
			items = [...character.items, ...monster.items].filter(item => monster.canUseItem(item));
			targetStr = monster.givenName;
		} else {
			items = [...character.items].filter(item => character.canUseItem(item));
			targetStr = `${character.pronouns.him}self`;
		}

		if (items.length < 1) {
			return Promise.reject(channel({
				announce: `${character.givenName} doesn't have any items that ${character.pronouns.he} can use on ${targetStr}.`
			}));
		}

		items = sortItemsAlphabetically(items);

		const getQuestion = ({ itemChoices }) =>
			(`Which item should ${character.givenName} use on ${targetStr}?

${itemChoices}`);

		return chooseItems({
			items,
			channel,
			getQuestion
		})
			.then(selectedItems => channel({
				question: 'Is this correct? (yes/no)'
			})
				.then((answer = '') => {
					if (answer.toLowerCase() === 'yes') {
						return selectedItems;
					}

					return Promise.reject(channel({ announce: 'You know what they always say, "An item saved is an item earned."' }));
				}));
	})
	.then(selectedItems => Promise.map(selectedItems, item => use({ channel, isMonsterItem: !!monster || !item.usableWithoutMonster, item, monster })));
