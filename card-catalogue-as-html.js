/* eslint-disable class-methods-use-this, max-len */
const Promise = require('bluebird');

const { actionCardHTML, itemCardHTML } = require('./helpers/card');
const allCards = require('./cards/helpers/all.js');
const allItems = require('./items/helpers/all.js');
const generateDocs = require('./helpers/generate-docs');

const cardList = allCards.map(({ cardType }) => `<a href="#${cardType}">${cardType}</a>`);
const itemList = allItems.map(({ itemType }) => `<a href="#${itemType}">${itemType}</a>`);

const generatecardCatalogue = (output) => {
	const header =
`
<pre>
				.------..------..------..------..------.
				|C.--. ||A.--. ||R.--. ||D.--. ||S.--. |
				| :/\\: || (\\/) || :(): || :/\\: || :/\\: |
				| :\\/: || :\\/: || ()() || (__) || :\\/: |
				| '--'C|| '--'A|| '--'R|| '--'D|| '--'S|
				\`------'\`------'\`------'\`------'\`------'
</pre>

<ul>
	<li><a href="#cardCatalogue">Card Catalogue</a></li>
	<li><a href="#itemCatalogue">Item Catalogue</a></li>
</ul>

<a name="cardCatalogue"></a>
<h2>The Card Catalogue</h2>

<ul>
	<li>${cardList.join('</li>\n<li>')}</li>
</ul>
`;

	return Promise.resolve()
		.then(() => output(header))
		.then(() => Promise.each(allCards, Card => output(actionCardHTML(new Card()))))
		.then(() => output(`


<a name="itemCatalogue"></a>
<h2>The Item Catalogue</h2>

<ul>
	<li>${itemList.join('</li>\n<li>')}</li>
</ul>
`))
		.then(() => Promise.each(allItems, Item => output(itemCardHTML(new Item()))));
};

const cardCatalogueAsHTML = ({ channel, output }) => generateDocs({ channel, generate: generatecardCatalogue, output });

module.exports = cardCatalogueAsHTML;
