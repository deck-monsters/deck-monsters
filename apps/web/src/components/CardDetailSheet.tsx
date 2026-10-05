import DetailSheet from './DetailSheet.js';
import { joinList, type CardFactsView, type VerdictMonster, verdictLine } from '../utils/cards.js';

interface CardDetailSheetProps {
  /** The facts for the card; null when the server's card list has not arrived (or the name is unknown). */
  facts: CardFactsView | null;
  /** The card's name as shown in the Workshop, for the fallback when `facts` is missing. */
  cardName: string;
  /** One verdict line per monster: the monster in view, or every monster for an unfiltered card. */
  monsters: VerdictMonster[];
  /** The control that opened the sheet, from the click event; focus returns to it on close. */
  opener?: HTMLElement | null;
  onClose: () => void;
}

/**
 * The card detail sheet (roadmap 44 K3): what a card does and whether the monster in view
 * can hold it. The sheet itself (portal, focus, Escape, backdrop) is `DetailSheet`.
 */
export default function CardDetailSheet({ facts, cardName, monsters, opener, onClose }: CardDetailSheetProps) {
  return (
    <DetailSheet
      title={facts?.name ?? cardName}
      titleId="card-detail-title"
      closeTitle="Close the card details"
      opener={opener}
      onClose={onClose}
    >
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
    </DetailSheet>
  );
}
