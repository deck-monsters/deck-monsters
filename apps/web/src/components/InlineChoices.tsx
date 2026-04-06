import { useEffect, useRef, useCallback, useState } from 'react';

interface InlineChoicesProps {
  requestId: string;
  question: string;
  choices: string[];
  selectedAnswer: string | null;
  timedOut: boolean;
  cancelled: boolean;
  onAnswer: (requestId: string, answer: string) => void;
  onCancel?: (requestId: string) => void;
}

/**
 * Multi-select: the equip/item flow sends questions containing "one or more"
 * or "card(s)". Single-select: spawn type/gender/avatar flows always expect
 * exactly one index back.
 */
function isMultiSelect(question: string): boolean {
  return /one or more|card\(s\)|item\(s\)/i.test(question);
}

export default function InlineChoices({
  requestId,
  question,
  choices,
  selectedAnswer,
  timedOut,
  cancelled,
  onAnswer,
  onCancel,
}: InlineChoicesProps) {
  const listRef = useRef<HTMLUListElement>(null);
  // Ordered array: each entry is the choice index, in the order the user picked them.
  // Position in this array = deck slot (1-based displayed to user).
  const [selectionOrder, setSelectionOrder] = useState<number[]>([]);
  const multi = isMultiSelect(question);

  // Move keyboard focus to the first choice button when rendered
  useEffect(() => {
    if (selectedAnswer || timedOut || cancelled) return;
    const first = listRef.current?.querySelector<HTMLButtonElement>('button');
    first?.focus();
  }, [selectedAnswer, timedOut, cancelled]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const btns = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[data-choice]') ?? []);
        btns[(idx + 1) % btns.length]?.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const btns = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[data-choice]') ?? []);
        btns[(idx - 1 + btns.length) % btns.length]?.focus();
      }
    },
    []
  );

  if (timedOut) {
    return (
      <div className="event-tombstone" role="status">
        <p>This action timed out. Try the command again.</p>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="event-tombstone" role="status">
        <p>Action cancelled.</p>
      </div>
    );
  }

  const isDone = selectedAnswer !== null;

  function handleSingleSelect(idx: number) {
    onAnswer(requestId, String(idx));
  }

  function handleToggle(idx: number) {
    setSelectionOrder(prev => {
      const pos = prev.indexOf(idx);
      if (pos >= 0) {
        // Deselect: remove from order, keeping other positions stable
        return prev.filter(i => i !== idx);
      } else {
        // Select: append to end — this becomes the next slot in the deck
        return [...prev, idx];
      }
    });
  }

  function handleConfirm() {
    if (selectionOrder.length === 0) return;
    // Send indices in the user's chosen order (not sorted) — deck slot order matters
    onAnswer(requestId, selectionOrder.join(', '));
  }

  return (
    <div className="event-prompt">
      <p className="prompt-question">{question}</p>
      <ul
        ref={listRef}
        role="listbox"
        aria-multiselectable={multi}
        aria-label="Choose an option"
        style={{ listStyle: 'none', padding: 0 }}
      >
        {choices.map((choice, idx) => {
          const slotPosition = multi ? selectionOrder.indexOf(idx) : -1;
          const isSelected = multi ? slotPosition >= 0 : selectedAnswer === String(idx);
          const slotLabel = slotPosition >= 0 ? slotPosition + 1 : null;

          return (
            <li key={idx} role="option" aria-selected={isSelected}>
              <button
                data-choice={idx}
                disabled={isDone}
                aria-pressed={isSelected}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: isSelected
                    ? 'var(--color-choice-selected)'
                    : 'transparent',
                  border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  color: isSelected ? 'var(--color-fg-bright)' : 'var(--color-fg)',
                  fontFamily: 'var(--font-family)',
                  fontSize: 'var(--font-size)',
                  padding: '0.25rem 0.5rem',
                  marginBottom: '0.25rem',
                  cursor: isDone ? 'default' : 'pointer',
                  opacity: isDone && !isSelected ? 0.5 : 1,
                }}
                onClick={() => multi ? handleToggle(idx) : handleSingleSelect(idx)}
                onKeyDown={(e) => handleKey(e, idx)}
              >
                {multi ? (
                  // Show slot position (1-based) when selected, empty brackets when not
                  <span style={{
                    display: 'inline-block',
                    width: '2.5rem',
                    marginRight: '0.4rem',
                    color: isSelected ? 'var(--color-accent)' : 'var(--color-fg-dim)',
                    fontWeight: isSelected ? 700 : 400,
                  }}>
                    {slotLabel !== null ? `[${slotLabel}]` : '[ ]'}
                  </span>
                ) : null}
                {choice}
              </button>
            </li>
          );
        })}
      </ul>
      {multi && !isDone && (
        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleConfirm}
            disabled={selectionOrder.length === 0}
            style={{
              padding: '0.3rem 0.75rem',
              background: selectionOrder.length > 0 ? 'var(--color-accent)' : 'transparent',
              border: '1px solid var(--color-accent)',
              color: selectionOrder.length > 0 ? 'var(--color-bg)' : 'var(--color-fg-dim)',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size)',
              cursor: selectionOrder.length > 0 ? 'pointer' : 'default',
            }}
          >
            Equip {selectionOrder.length > 0 ? `${selectionOrder.length} card${selectionOrder.length !== 1 ? 's' : ''}` : 'cards'}
          </button>
          {selectionOrder.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-fg-dim)' }}>
              Order: {selectionOrder.map(i => choices[i]).join(' → ')}
            </span>
          )}
          {onCancel && (
            <button
              onClick={() => onCancel(requestId)}
              style={{
                padding: '0.3rem 0.75rem',
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-fg-dim)',
                fontFamily: 'var(--font-family)',
                fontSize: 'var(--font-size)',
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}
      {!multi && !isDone && onCancel && (
        <div style={{ marginTop: '0.25rem' }}>
          <button
            onClick={() => onCancel(requestId)}
            style={{
              padding: '0.2rem 0.5rem',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-fg-dim)',
              fontFamily: 'var(--font-family)',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
