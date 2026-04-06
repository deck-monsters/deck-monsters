import { useEffect, useRef, useCallback } from 'react';

interface InlineChoicesProps {
  requestId: string;
  question: string;
  choices: string[];
  selectedAnswer: string | null;
  timedOut: boolean;
  cancelled: boolean;
  onAnswer: (requestId: string, answer: string) => void;
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
        const btns = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
        btns[(idx + 1) % btns.length]?.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const btns = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
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

  return (
    <div className="event-prompt">
      <p className="prompt-question">{question}</p>
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Choose an option"
        style={{ listStyle: 'none', padding: 0 }}
      >
        {choices.map((choice, idx) => {
          const isSelected = selectedAnswer === choice;
          return (
            <li key={idx} role="option" aria-selected={isSelected}>
              <button
                data-choice={idx}
                disabled={selectedAnswer !== null}
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
                  cursor: selectedAnswer !== null ? 'default' : 'pointer',
                  opacity: selectedAnswer !== null && !isSelected ? 0.5 : 1,
                }}
                onClick={() => onAnswer(requestId, choice)}
                onKeyDown={(e) => handleKey(e, idx)}
              >
                [{idx}] {choice}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
