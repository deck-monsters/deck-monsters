import CardSlot, { type WorkshopCardLocation } from './CardSlot.js';

interface InventoryPanelProps {
  cards: string[];
  selectedCards: Array<{
    location: WorkshopCardLocation;
    cardName: string;
    selectionId: string;
  }>;
  onDropCard: (source: WorkshopCardLocation, cardName: string) => Promise<void> | void;
  onTapSlot: () => Promise<void> | void;
  onSelectCard: (location: WorkshopCardLocation, cardName: string, selectionId: string) => void;
  activeMonsterFilterName?: string | null;
  compatibleCardCount?: number | null;
  onClearMonsterFilter?: () => void;
  isCardUnavailable?: (cardName: string) => boolean;
}

export default function InventoryPanel({
  cards,
  selectedCards,
  onDropCard,
  onTapSlot,
  onSelectCard,
  activeMonsterFilterName = null,
  compatibleCardCount = null,
  onClearMonsterFilter,
  isCardUnavailable,
}: InventoryPanelProps) {
  const location: WorkshopCardLocation = { kind: 'inventory' };
  return (
    <section className="workshop-inventory">
      <header className="workshop-section-header">
        <div>
          <h2>Your Inventory</h2>
          {activeMonsterFilterName && (
            <p className="workshop-filter-summary">
              Showing cards usable by {activeMonsterFilterName}
              {typeof compatibleCardCount === 'number' ? ` (${compatibleCardCount}/${cards.length})` : ''}.
            </p>
          )}
        </div>
        <div className="workshop-inventory-summary">
          <span>{cards.length} unequipped cards</span>
          {activeMonsterFilterName && (
            <button type="button" className="btn workshop-inline-btn" onClick={() => onClearMonsterFilter?.()}>
              Clear filter
            </button>
          )}
        </div>
      </header>

      {cards.length < 1 ? (
        <div className="workshop-empty-state">No unequipped cards.</div>
      ) : (
        <div className="workshop-card-grid inventory-grid">
          {cards.map((cardName, index) => {
            const selectionId = `inventory:${index}`;
            const unavailable = isCardUnavailable?.(cardName) ?? false;
            return (
              <CardSlot
                key={`${cardName}-${index}`}
                location={location}
                selectionId={selectionId}
                cardName={cardName}
                disabled={unavailable}
                incompatible={unavailable}
                selected={selectedCards.some(
                  (selectedCard) =>
                    selectedCard.location.kind === 'inventory' &&
                    selectedCard.selectionId === selectionId,
                )}
                onTapSlot={() => onTapSlot()}
                onSelectCard={onSelectCard}
              />
            );
          })}
        </div>
      )}

      <div
        className="workshop-drop-zone"
        onDrop={(event) => {
          event.preventDefault();
          const payload = event.dataTransfer.getData('application/x-deck-monsters-card');
          if (!payload) return;
          try {
            const parsed = JSON.parse(payload) as { location: WorkshopCardLocation; cardName: string };
            void onDropCard(parsed.location, parsed.cardName);
          } catch {
            // Ignore malformed payloads.
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onClick={() => {
          void onTapSlot();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void onTapSlot();
          }
        }}
      >
        Drop here to unequip from monster
      </div>
    </section>
  );
}
