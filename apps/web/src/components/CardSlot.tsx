import { abbreviateCardName, getCardClass, getCardEmoji } from '../utils/cards.js';

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
}: CardSlotProps) {
  const cardClass = cardName ? getCardClass(cardName) : 'utility';

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
    <button
      type="button"
      className={[
        'workshop-card-slot',
        cardName ? `class-${cardClass}` : 'empty',
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
      title={cardName ? (incompatible ? `${cardName} (not usable for current filter)` : cardName) : 'Empty slot'}
      aria-label={cardName ? (incompatible ? `${cardName} (not usable for current filter)` : cardName) : 'Empty slot'}
    >
      {cardName ? (
        <>
          <span className="workshop-card-icon">{getCardEmoji(cardName)}</span>
          <span className="workshop-card-name">{abbreviateCardName(cardName)}</span>
          <span className="workshop-card-class">{cardClass}</span>
        </>
      ) : (
        <span>[+]</span>
      )}
    </button>
  );
}
