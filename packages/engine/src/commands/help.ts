import { formatCommandList, formatCommandSearch } from './catalog.js';

const HELP_REGEX = /^(?:(?:help|commands?)|help\s+\S.*)$/i;

// Fights are otherwise hands-off once a monster is in the ring: no re-equipping, no calling
// it back and in again, no changing its cards. Items are the deliberate exception —
// `useItems` skips the `inEncounter` guard every other inventory action has, because items
// are meant to be the one real-time decision in an otherwise commit-then-watch game (see
// docs/architecture/workshop-and-items.md). That rule is easy to never discover, so
// `help` states it outright instead of leaving it to be found in the item commands alone.
const ITEMS_NOTE = `-- One Thing Worth Knowing --
  Once a fight starts you can't touch a monster's deck — but it can still use items it is
  already carrying. That is the one action left mid-fight.

  Nothing can be handed over once the fighting starts, so what a monster takes into the
  ring is what it has. Stock it up first: "give [item] to [monster]".

  Targeting scrolls are worth a look too: they change who a monster attacks
  (use [scroll] on [monster]), and the choice sticks — "look at [monster]" shows its
  current Strategy.`;

// `listen` lowercases the command for matching, so it hands the trimmed text as typed in
// `command` — the "Commands with ..." heading echoes what the player typed.
function helpAction({ channel, command = '' }: any): Promise<unknown> {
	const word = String(command).replace(/^help\s+/i, '').trim();
	if (/^help\s+\S/i.test(String(command).trim())) {
		return channel({ announce: formatCommandSearch(word) });
	}
	return channel({ announce: `${formatCommandList()}\n\n${ITEMS_NOTE}` });
}

const helpHandler = {
	matcher: HELP_REGEX,
	action: helpAction,
};

export default helpHandler;
export { helpHandler };
