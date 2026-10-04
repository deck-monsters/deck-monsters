import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { joinList, type CardFactsView, type VerdictMonster, verdictLine } from '../utils/cards.js';

interface CardDetailSheetProps {
  /** The facts for the card; null when the server's card list has not arrived (or the name is unknown). */
  facts: CardFactsView | null;
  /** The card's name as shown in the Workshop, for the fallback when `facts` is missing. */
  cardName: string;
  /** One verdict line per monster: the monster in view, or every monster for an unfiltered card. */
  monsters: VerdictMonster[];
  onClose: () => void;
}

/**
 * The card detail sheet (roadmap 44 K3): what a card does and whether the monster in view
 * can hold it. A bottom sheet on a phone and a modest dialog on a wide screen (CSS only).
 *
 * Rendered in a portal on `document.body` because the Workshop sits inside terminal panes
 * whose overflow and stacking would clip a `position: fixed` child. Focus moves to Close on
 * open and returns to the control that opened it; Escape and a tap on the backdrop close it.
 */
export default function CardDetailSheet({ facts, cardName, monsters, onClose }: CardDetailSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      // The opener may have unmounted (the card moved while the sheet was open).
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const title = facts?.name ?? cardName;

  return createPortal(
    <div
      className="card-detail-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="card-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="card-detail-title">
        <h2 id="card-detail-title">{title}</h2>
        {facts && (
          <>
            <p className="card-detail-role">{facts.roleLabel}</p>
            {facts.description && <p>{facts.description}</p>}
            {facts.stats && <p>{facts.stats}</p>}
            <p>Level: {facts.level > 0 ? facts.level : 'Beginner'}</p>
            <p>Used by: {facts.usedBy.length > 0 ? joinList(facts.usedBy) : 'Any monster'}</p>
            <p>Price: {facts.price > 0 ? `${facts.price} ${facts.price === 1 ? 'coin' : 'coins'}` : 'free'}</p>
            {monsters.length > 0 && (
              <ul className="card-detail-verdicts">
                {monsters.map((monster) => (
                  <li key={monster.name}>{verdictLine(facts, monster)}</li>
                ))}
              </ul>
            )}
          </>
        )}
        <button
          ref={closeRef}
          type="button"
          className="btn card-detail-close"
          title="Close the card details"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
