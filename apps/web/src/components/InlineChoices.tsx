import { useEffect, useRef, useCallback, useState } from 'react';

interface InlineChoicesProps {
  requestId: string;
  question: string;
  choices: string[];
  selectedAnswer: string | null;
  timedOut: boolean;
  cancelled: boolean;
  onAnswer: (requestId: string, answer: string) => void;
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
}: InlineChoicesProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
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
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (selected.size === 0) return;
    const answer = Array.from(selected).sort((a, b) => a - b).join(', ');
    onAnswer(requestId, answer);
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
          const isSelected = multi ? selected.has(idx) : selectedAnswer === String(idx);
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
                {multi && (
                  <span style={{ marginRight: '0.4rem', opacity: 0.7 }}>
                    {isSelected ? '[x]' : '[ ]'}
                  </span>
                )}
                [{idx}] {choice}
              </button>
            </li>
          );
        })}
      </ul>
      {multi && !isDone && (
        <button
          onClick={handleConfirm}
          disabled={selected.size === 0}
          style={{
            marginTop: '0.5rem',
            padding: '0.3rem 0.75rem',
            background: selected.size > 0 ? 'var(--color-accent)' : 'transparent',
            border: '1px solid var(--color-accent)',
            color: selected.size > 0 ? 'var(--color-bg)' : 'var(--color-fg-dim)',
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size)',
            cursor: selected.size > 0 ? 'pointer' : 'default',
          }}
        >
          Equip selected ({selected.size})
        </button>
      )}
    </div>
  );
}
