import { useRef, useEffect } from 'react';
import type { AutocompleteSuggestion } from '../hooks/useCommandAutocomplete.js';

interface CommandSuggestionsProps {
  suggestions: AutocompleteSuggestion[];
  activeIndex: number;
  onSelect: (value: string) => void;
  onDismiss: () => void;
}

export default function CommandSuggestions({
  suggestions,
  activeIndex,
  onSelect,
  onDismiss,
}: CommandSuggestionsProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (suggestions.length === 0) return null;

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label="Command suggestions"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: '2px',
        listStyle: 'none',
        padding: 0,
        margin: 0,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        maxHeight: '12rem',
        overflowY: 'auto',
        zIndex: 10,
      }}
    >
      {suggestions.map((s, idx) => (
        <li
          key={s.label}
          role="option"
          aria-selected={idx === activeIndex}
          style={{
            padding: '0.35rem 0.6rem',
            cursor: 'pointer',
            background: idx === activeIndex ? 'var(--color-choice-selected, rgba(255,255,255,0.1))' : 'transparent',
            borderBottom: idx < suggestions.length - 1 ? '1px solid var(--color-border)' : 'none',
            fontFamily: 'var(--font-family)',
            fontSize: '0.8rem',
            color: idx === activeIndex ? 'var(--color-fg-bright)' : 'var(--color-fg)',
          }}
          onMouseDown={(e) => {
            e.preventDefault(); // Don't lose focus from input
            onSelect(s.insertValue);
          }}
          onMouseEnter={() => {}}
        >
          {s.label}
        </li>
      ))}
      <li
        style={{
          padding: '0.2rem 0.6rem',
          fontSize: '0.7rem',
          color: 'var(--color-fg-dim)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        Tab to complete · Esc to dismiss
      </li>
    </ul>
  );
}
