import { useEffect, useRef } from 'react';
import { CATEGORY_LABELS, COMMAND_CATALOG, type CommandCategory } from '@deck-monsters/engine';

interface CommandReferenceProps {
  open: boolean;
  onClose: () => void;
  onInsertCommand: (command: string) => void;
}

// One home for the labels and their order: the engine's `CATEGORY_LABELS` (object key order is
// the display order), so a new category cannot be added there and missing here.
export { CATEGORY_LABELS };
export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as CommandCategory[];

export default function CommandReference({ open, onClose, onInsertCommand }: CommandReferenceProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus close button when panel opens
  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const grouped = CATEGORY_ORDER.reduce<Record<CommandCategory, typeof COMMAND_CATALOG>>((acc, cat) => {
    acc[cat] = COMMAND_CATALOG.filter(e => e.category === cat);
    return acc;
  }, {} as Record<CommandCategory, typeof COMMAND_CATALOG>);

  // Strip placeholder brackets for insertion (e.g. "equip [monster]" -> "equip ")
  function commandToInsert(cmd: string): string {
    return cmd.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trimEnd();
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'var(--color-backdrop-light)',
          }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Command Reference"
        aria-modal="true"
        aria-hidden={!open}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...(!open ? { inert: '' } : {})}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(380px, 92vw)',
          zIndex: 101,
          background: 'var(--color-bg)',
          borderLeft: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <span style={{ flex: 1, fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.85rem' }}>
            CONSOLE COMMANDS
          </span>
          <button
            title="Close the Console commands"
            ref={closeRef}
            onClick={onClose}
            aria-label="Close Console commands"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-fg)',
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8rem',
              padding: '0.2rem 0.5rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/*
          The Handbook / Monster Manual / Card List shortcuts were removed (bug 230): the guides
          live in Help and guides, and this panel is now named for what it is, Console commands.
        */}

        {/* Scrollable command list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
          {CATEGORY_ORDER.map(cat => {
            const entries = grouped[cat];
            if (!entries.length) return null;
            return (
              <div key={cat}>
                <div
                  style={{
                    padding: '0.4rem 1rem 0.2rem',
                    fontSize: '0.7rem',
                    color: 'var(--color-fg-dim)',
                    letterSpacing: '0.1em',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  {CATEGORY_LABELS[cat].toUpperCase()}
                </div>
                {/*
                  Fights are otherwise hands-off once a monster is in the ring — no
                  re-equipping, no calling it back and in again. Items are the deliberate
                  exception: `useItems` has no `inEncounter` guard, on purpose, because items
                  are meant to be the one real-time decision in the game (see
                  docs/architecture/workshop-and-items.md). That's easy to never
                  discover, so the items panel says so directly instead of leaving it
                  implicit in the command list.
                */}
                {cat === 'items' && (
                  <div
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.75rem',
                      color: 'var(--color-fg-dim)',
                      borderBottom: '1px solid var(--color-border)',
                      lineHeight: 1.4,
                    }}
                  >
                    A monster can still use items once a fight starts — but only ones it is
                    already carrying. Nothing can be handed over mid-fight, so stock it up
                    before it goes to the ring.
                    <br />
                    Targeting scrolls change who a monster attacks; its stat card shows them
                    as its orders.
                  </div>
                )}
                {entries.map((entry) => (
                  <button
                    key={entry.command}
                    onClick={() => { onInsertCommand(commandToInsert(entry.command)); onClose(); }}
                    title={entry.example ? `Example: ${entry.example}` : `Insert: ${entry.command}`}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--color-border)',
                      color: 'var(--color-fg)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.8rem',
                      padding: '0.5rem 1rem',
                      cursor: 'pointer',
                      lineHeight: 1.4,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-hover, rgba(255,255,255,0.05))';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    <div style={{ color: 'var(--color-fg-bright)', marginBottom: '0.1rem' }}>
                      {entry.command}
                    </div>
                    <div style={{ color: 'var(--color-fg-dim)', fontSize: '0.75rem' }}>
                      {entry.description}
                    </div>
                    {entry.example && (
                      <div style={{ color: 'var(--color-accent)', fontSize: '0.7rem', marginTop: '0.1rem' }}>
                        eg: {entry.example}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
