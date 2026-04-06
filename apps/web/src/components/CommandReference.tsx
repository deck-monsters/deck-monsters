import { useEffect, useRef } from 'react';
import { COMMAND_CATALOG, type CommandCategory } from '@deck-monsters/engine';

interface CommandReferenceProps {
  open: boolean;
  onClose: () => void;
  onInsertCommand: (command: string) => void;
}

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  monsters: 'Monsters',
  ring: 'The Ring',
  cards: 'Cards',
  items: 'Items',
  shop: 'The Shop',
  character: 'Your Character',
  info: 'Reference',
};

const CATEGORY_ORDER: CommandCategory[] = [
  'monsters', 'ring', 'cards', 'items', 'shop', 'character', 'info',
];

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
            background: 'rgba(0,0,0,0.5)',
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
            COMMAND REFERENCE
          </span>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close command reference"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-fg)',
              fontFamily: 'var(--font-family)',
              fontSize: '0.8rem',
              padding: '0.2rem 0.5rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Quick links */}
        <div
          style={{
            padding: '0.5rem 1rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.4rem',
            flexShrink: 0,
          }}
        >
          {[
            { label: 'Handbook', cmd: 'look at player handbook' },
            { label: 'Monster Manual', cmd: 'look at monster manual' },
            { label: 'Card List', cmd: 'look at cards' },
          ].map(({ label, cmd }) => (
            <button
              key={cmd}
              onClick={() => { onInsertCommand(cmd); onClose(); }}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-fg-dim)',
                fontFamily: 'var(--font-family)',
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                cursor: 'pointer',
              }}
              title={`Run: ${cmd}`}
            >
              {label}
            </button>
          ))}
        </div>

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
                      fontFamily: 'var(--font-family)',
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
