import { CARD_ROLE_SLOT_LABEL, abbreviateCardName, getCardEmoji, getCardRole, isLongCardName } from '../utils/cards.js';

export type WorkshopCardLocation =
  | { kind: 'inventory' }
  | { kind: 'monster'; monsterName: string };

interface CardSlotProps {
  location: WorkshopCardLocation;
  selectionId: string;
  cardName: string | null;
  isDropActive?: boolean;
  disabled?: boolean;
  incompatible?: boolean;
  selected?: boolean;
  onSelectCard?: (
    location: WorkshopCardLocation,
    cardName: string,
    selectionId: string,
    slotIndex?: number,
  ) => void;
  onDropCard?: (
    source: WorkshopCardLocation,
    cardName: string,
    sourceSelectionId?: string,
  ) => Promise<void> | void;
  onTapSlot?: (target: WorkshopCardLocation) => Promise<void> | void;
  /**
   * Opens the card's detail sheet. The control is a sibling of the slot button, not a child:
   * a button inside a button is invalid HTML and would swallow the tap that selects the card.
   * It stays enabled on a disabled slot (locked monster, filtered-out card) because reading
   * what a card does changes nothing.
   */
  onShowDetails?: (cardName: string, opener: HTMLElement) => void;
}

export default function CardSlot({
  location,
  selectionId,
  cardName,
  isDropActive = false,
  disabled = false,
  incompatible = false,
  selected = false,
  onSelectCard,
  onDropCard,
  onTapSlot,
  onShowDetails,
}: CardSlotProps) {
  const role = cardName ? getCardRole(cardName) : undefined;

  async function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    if (disabled) return;
    const payload = event.dataTransfer.getData('application/x-deck-monsters-card');
    if (!payload) return;
    event.preventDefault();
    try {
      const parsed = JSON.parse(payload) as {
        location: WorkshopCardLocation;
        cardName: string;
        selectionId?: string;
      };
      await onDropCard?.(parsed.location, parsed.cardName, parsed.selectionId);
    } catch {
      // Ignore malformed payloads.
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLButtonElement>) {
    if (disabled) return;
    event.preventDefault();
  }

  function handleDragStart(event: React.DragEvent<HTMLButtonElement>) {
    if (!cardName || disabled) return;
    event.dataTransfer.setData(
      'application/x-deck-monsters-card',
      JSON.stringify({ location, cardName, selectionId }),
    );
    event.dataTransfer.effectAllowed = 'move';
  }

  async function handleClick() {
    if (disabled) return;
    if (cardName) {
      const slotFromSelectionId = Number.parseInt(selectionId.split(':').at(-1) ?? '', 10);
      const slotIndex = Number.isFinite(slotFromSelectionId) ? slotFromSelectionId : undefined;
      onSelectCard?.(location, cardName, selectionId, slotIndex);
      return;
    }
    await onTapSlot?.(location);
  }

  return (
    <div className="workshop-card-cell">
    <button
      type="button"
      className={[
        'workshop-card-slot',
        cardName ? `role-${role ?? 'none'}` : 'empty',
        isDropActive ? 'drop-over' : '',
        selected ? 'selected' : '',
        disabled ? 'disabled' : '',
        incompatible ? 'incompatible' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      draggable={Boolean(cardName && !disabled)}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={(event) => void handleDrop(event)}
      onClick={() => void handleClick()}
      title={cardName ? (incompatible ? `${cardName} (not usable for current filter)` : cardName) : 'Empty slot. Tap to see cards for it'}
      aria-label={cardName ? (incompatible ? `${cardName} (not usable for current filter)` : cardName) : 'Empty slot'}
    >
      {cardName ? (
        <>
          <span className="workshop-card-icon">{getCardEmoji(cardName)}</span>
          <span className={`workshop-card-name${isLongCardName(cardName) ? ' compact' : ''}`}>{abbreviateCardName(cardName)}</span>
          {role && <span className="workshop-card-class">{CARD_ROLE_SLOT_LABEL[role]}</span>}
        </>
      ) : (
        <span>[+]</span>
      )}
    </button>
    {cardName && onShowDetails && (
      <button
        type="button"
        className="workshop-card-info"
        title="What this card does"
        aria-label={`What ${cardName} does`}
        onClick={(event) => onShowDetails(cardName, event.currentTarget)}
      >
        ⓘ
      </button>
    )}
    </div>
  );
}
