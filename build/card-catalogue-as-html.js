/* eslint-disable max-len */
import { actionCardHTML, itemCardHTML } from '../packages/engine/src/helpers/card.js';
import { all as allCards } from '../packages/engine/src/cards/helpers/all.js';
import allItems from '../packages/engine/src/items/helpers/all.js';
import { eachSeries } from '../packages/engine/src/helpers/promise.js';
import generateDocs from './generate-docs.js';

const cardList = allCards.map(({ cardType }) => `<a href="#${cardType}">${cardType}</a>`);
const itemList = allItems.map(({ itemType }) => `<a href="#${itemType}">${itemType}</a>`);

const generateCardCatalogueAsHTML = (output) => {
	const header =
`
<!DOCTYPE html>
<html>
<head>
<style>
  article {
    break-before: auto;
    border: 1px solid black;
    display: block;
    width: 300px;
    height: 400px;
    padding: 15px;
    float: left;
  }

  h3 {
    margin: -12px 0 4px -12px;
  }

  ul {
    clear: both;
    display: block;
  }
</style>
</head>
<body>
<!--  <pre>
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
    <!--li>${cardList.join('</li>\n<li>')}</li>
  </ul-->
`;

	return Promise.resolve()
		.then(() => output(header))
		.then(() => eachSeries(allCards, Card => output(actionCardHTML(new Card()))))
		.then(() => output(`


  <!--a name="itemCatalogue"></a>
  <h2>The Item Catalogue</h2>

  <ul>
    <li>${itemList.join('</li>\n<li>')}</li>
  </ul-->
`))
		.then(() => eachSeries(allItems, Item => output(itemCardHTML(new Item()))))
		.then(() => output(`
</body>
</html>
`));
};

const cardCatalogueAsHTML = ({ channel, output } = {}) => generateDocs({ channel, generate: generateCardCatalogueAsHTML, output });

export default cardCatalogueAsHTML;
