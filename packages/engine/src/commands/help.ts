import { formatCommandList } from './catalog.js';

const HELP_REGEX = /^(?:help|commands?)$/i;

// Fights are otherwise hands-off once a monster is in the ring: no re-equipping, no calling
// it back and in again, no changing its cards. Items are the deliberate exception —
// `useItems` skips the `inEncounter` guard every other inventory action has, because items
// are meant to be the one real-time decision in an otherwise commit-then-watch game (see
// docs/roadmap/19-player-agency-and-items.md §3). That rule is easy to never discover, so
// `help` states it outright instead of leaving it to be found in the item commands alone.
const ITEMS_NOTE = `-- One Thing Worth Knowing --
  Once a fight starts you can't touch a monster's deck — but you can still use items on it.
  Items are the one action that still works mid-fight; everything else has to be decided
  before the monster goes to the ring.

  Targeting scrolls are worth a look too: they change who a monster attacks
  (use [scroll] on [monster]), and the choice sticks — "look at [monster]" shows its
  current Strategy.`;

function helpAction({ channel }: any): Promise<unknown> {
	return channel({ announce: `${formatCommandList()}\n\n${ITEMS_NOTE}` });
}

const helpHandler = {
	matcher: HELP_REGEX,
	action: helpAction,
};

export default helpHandler;
export { helpHandler };
