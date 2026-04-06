import { useMemo } from 'react';
import { COMMAND_CATALOG } from '@deck-monsters/engine';

export interface AutocompleteSuggestion {
  label: string;
  insertValue: string;
}

/**
 * Returns up to 5 command suggestions for the current input.
 * Matches on command prefix or any word in the command.
 */
export function useCommandAutocomplete(input: string, enabled = true): AutocompleteSuggestion[] {
  return useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!enabled || q.length < 2) return [];

    const results: AutocompleteSuggestion[] = [];
    const seen = new Set<string>();

    for (const entry of COMMAND_CATALOG) {
      const cmd = entry.command.toLowerCase();
      // Exact prefix match (highest priority)
      const prefixMatch = cmd.startsWith(q);
      // Any-word match
      const wordMatch = !prefixMatch && cmd.split(' ').some(word => word.startsWith(q));

      if (prefixMatch || wordMatch) {
        const insertValue = entry.command.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trimEnd();
        if (!seen.has(entry.command)) {
          seen.add(entry.command);
          results.push({ label: entry.command, insertValue });
        }
      }

      if (results.length >= 5) break;
    }

    // Sort: prefix matches first
    results.sort((a, b) => {
      const aPrefix = a.label.toLowerCase().startsWith(q) ? 0 : 1;
      const bPrefix = b.label.toLowerCase().startsWith(q) ? 0 : 1;
      return aPrefix - bPrefix;
    });

    return results.slice(0, 5);
  }, [input, enabled]);
}
