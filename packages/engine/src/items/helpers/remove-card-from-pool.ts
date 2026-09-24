/**
 * Removes exactly one card instance from a character's unequipped pool
 * (`character.cards`), without going through `character.removeCard`.
 *
 * `Beastmaster.removeCard` overrides the base implementation to also call
 * `monster.resetCards({ matchCard })` on every owned monster — and `resetCards`
 * clears a monster's **entire** hand if it holds any card that is JSON-identical
 * (same `cardType`/props) to the one being removed, via the same value-equality
 * `isMatchingItem` helper `characters/base.ts#removeCard` itself uses to find the
 * pool entry. That check was written for a single array (find the matching entry
 * in *this* pool), not for reaching into a different creature's deck: by the time
 * a card is equipped, `Beastmaster#reconcileDeckAfterEquip` has already spliced it
 * out of `character.cards` *by object identity* specifically so equipped and
 * unequipped cards never share instances — but `resetCards`'s value match doesn't
 * care about identity, so any monster holding a plain `Hit` loses its whole
 * equipped deck the moment the character sells an unrelated, unequipped `Hit`.
 * Both shop sell paths (`items/store/sell.ts`, `items/store/sell-to-shop.ts`) only
 * ever remove from `character.cards`/`character.items` (see
 * `docs/architecture/workshop-and-items.md#inventory-read-model` — an equipped
 * card has already left those arrays), so there is never a monster's card to
 * reconcile here; use this instead of `character.removeCard` (bug #182).
 *
 * Removal is by object identity (not `isMatchingItem`) for the same reason
 * `reconcileDeckAfterEquip` uses identity: duplicate card types are legitimate,
 * so matching by value could splice out the wrong instance among several
 * otherwise-identical copies.
 *
 * Mirrors the two signals the real `removeCard` emits: the `cards` setter
 * (`setOptions`) is what tells the owning `Game` to persist, and `cardRemoved`
 * is the semantic event other code may come to depend on.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const removeCardFromPool = (character: any, card: any): boolean => {
	const pool = character.cards ?? [];
	const index = pool.indexOf(card);

	if (index === -1) return false;

	const remaining = [...pool];
	remaining.splice(index, 1);
	character.cards = remaining;
	character.emit('cardRemoved', { card });

	return true;
};

export default removeCardFromPool;
