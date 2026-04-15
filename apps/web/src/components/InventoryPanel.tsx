import CardSlot, { type WorkshopCardLocation } from './CardSlot.js';

interface InventoryPanelProps {
  cards: string[];
  selectedCard: {
    location: WorkshopCardLocation;
    cardName: string;
  } | null;
  onDropCard: (source: WorkshopCardLocation, cardName: string) => Promise<void> | void;
  onTapSlot: () => Promise<void> | void;
  onSelectCard: (location: WorkshopCardLocation, cardName: string) => void;
}

export default function InventoryPanel({
  cards,
  selectedCard,
  onDropCard,
  onTapSlot,
  onSelectCard,
}: InventoryPanelProps) {
  const location: WorkshopCardLocation = { kind: 'inventory' };

  return (
    <section className="workshop-inventory">
      <header className="workshop-section-header">
        <h2>Your Inventory</h2>
        <span>{cards.length} unequipped cards</span>
      </header>

      {cards.length < 1 ? (
        <div className="workshop-empty-state">No unequipped cards.</div>
      ) : (
        <div className="workshop-card-grid inventory-grid">
          {cards.map((cardName, index) => (
            <CardSlot
              key={`${cardName}-${index}`}
              location={location}
              cardName={cardName}
              selected={
                selectedCard?.location.kind === 'inventory' &&
                selectedCard.cardName === cardName
              }
              hasActiveSelection={Boolean(selectedCard)}
              onTapSlot={() => onTapSlot()}
              onSelectCard={onSelectCard}
            />
          ))}
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
