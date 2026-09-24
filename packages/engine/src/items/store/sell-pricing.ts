/**
 * Single source of truth for what the shop pays for a card or item, shared by the
 * console's prompt-driven `sellItems` (sell.ts) and the prompt-free `sellToShop`
 * (sell-to-shop.ts) so a rounding or offset change can never make the two disagree
 * about the price of the same sale.
 *
 * The offset is always `shop.priceOffset` (0.6-0.9, see shop.ts) — the same rate for
 * both items and cards, and always below 1, which is the mechanical half of the
 * handbook's "never sell to the shop for less than a card is worth" line: the shop
 * never pays face value or more, only ever a fraction of it. That line is a
 * description of the shop's own behaviour, not a floor this code enforces.
 */
export const getSalePrice = (item: { cost: number }, priceOffset: number): number =>
	Math.round(item.cost * priceOffset);

export const getSaleTotal = (items: Array<{ cost: number }>, priceOffset: number): number =>
	items.reduce((total, item) => total + getSalePrice(item, priceOffset), 0);
