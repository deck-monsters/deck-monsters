import { abbreviateCardName, getCardClass, getCardEmoji } from '../utils/cards.js';

export type WorkshopCardLocation =
  | { kind: 'inventory' }
  | { kind: 'monster'; monsterName: string };

interface CardSlotProps {
  location: WorkshopCardLocation;
  cardName: string | null;
  isDropActive?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onSelectCard?: (location: WorkshopCardLocation, cardName: string) => void;
  onDropCard?: (source: WorkshopCardLocation, cardName: string) => Promise<void> | void;
  onTapSlot?: (target: WorkshopCardLocation) => Promise<void> | void;
}

export default function CardSlot({
  location,
  cardName,
  isDropActive = false,
  disabled = false,
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
      const parsed = JSON.parse(payload) as { location: WorkshopCardLocation; cardName: string };
      await onDropCard?.(parsed.location, parsed.cardName);
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
      JSON.stringify({ location, cardName }),
    );
    event.dataTransfer.effectAllowed = 'move';
  }

  async function handleClick() {
    if (disabled) return;
    if (cardName) {
      onSelectCard?.(location, cardName);
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
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      draggable={Boolean(cardName && !disabled)}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={(event) => void handleDrop(event)}
      onClick={() => void handleClick()}
      title={cardName ?? 'Empty slot'}
      aria-label={cardName ?? 'Empty slot'}
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
