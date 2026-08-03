import { actionCardHTML, itemCardHTML } from '../helpers/card.js';
import allCards from '../cards/helpers/all.js';
import allItems from '../items/helpers/all.js';
import { eachSeries } from '../helpers/promise.js';

import type { DocOutputFn } from './dungeon-master-guide.js';

const HTML_HEADER = `<!DOCTYPE html>
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
`;

const HTML_FOOTER = `
</body>
</html>
`;

export const generateCardCatalogueHtml = async (output: DocOutputFn): Promise<void> => {
	await output(HTML_HEADER);
	await eachSeries(allCards, Card => output(actionCardHTML(new Card())));
	await eachSeries(allItems, Item => output(itemCardHTML(new Item())));
	await output(HTML_FOOTER);
};

export default generateCardCatalogueHtml;
