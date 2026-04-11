import { useMemo } from 'react';
import { COMMAND_CATALOG } from '@deck-monsters/engine';

export interface AutocompleteSuggestion {
  label: string;
  insertValue: string;
}

const MONSTER_COMMAND_RE = /\[monster\]/i;

type MonsterAutocompleteContext = {
  monsterNames?: string[];
  deadMonsterNames?: string[];
  sendableMonsterNames?: string[];
};

function normalizeCommand(input: string): string {
  return input.replace(/\s+/g, ' ').trim().toLowerCase();
}

function expandMonsterPlaceholder(command: string, monsterName: string): string {
  return command.replace(/\[monster\]/gi, monsterName);
}

/**
 * Returns up to 5 command suggestions for the current input.
 * Matches on command prefix or any word in the command.
 */
export function useCommandAutocomplete(
  input: string,
  enabled = true,
  context: MonsterAutocompleteContext = {},
): AutocompleteSuggestion[] {
  return useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!enabled || q.length < 2) return [];

    const results: AutocompleteSuggestion[] = [];
    const seenInsertValues = new Set<string>();
    const normalizedQuery = normalizeCommand(q);
    const monsterNames = context.monsterNames ?? [];
    const deadMonsterNames = context.deadMonsterNames ?? [];
    const sendableMonsterNames = context.sendableMonsterNames ?? [];

    for (const entry of COMMAND_CATALOG) {
      const hasMonsterPlaceholder = MONSTER_COMMAND_RE.test(entry.command);
      let namesForTemplate = monsterNames;
      if (/^revive \[monster\]$/i.test(entry.command)) {
        namesForTemplate = deadMonsterNames;
      } else if (/^send \[monster\] to the ring$/i.test(entry.command)) {
        namesForTemplate = sendableMonsterNames;
      }
      const expandedCommands = hasMonsterPlaceholder && monsterNames.length > 0
        ? namesForTemplate.map((name) => ({
            label: expandMonsterPlaceholder(entry.command, name),
            insertValue: expandMonsterPlaceholder(entry.command, name),
          }))
        : [{
            label: entry.command,
            insertValue: entry.command.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trimEnd(),
          }];

      for (const candidate of expandedCommands) {
        const cmd = normalizeCommand(candidate.label);
        const prefixMatch = cmd.startsWith(normalizedQuery);
        const wordMatch = !prefixMatch && cmd.split(' ').some(word => word.startsWith(normalizedQuery));

        if (prefixMatch || wordMatch) {
          if (!seenInsertValues.has(candidate.insertValue)) {
            seenInsertValues.add(candidate.insertValue);
            results.push(candidate);
          }
        }

        if (results.length >= 5) break;
      }
      if (results.length >= 5) break;
    }

    // Sort: prefix matches first
    results.sort((a, b) => {
      const aPrefix = normalizeCommand(a.label).startsWith(normalizedQuery) ? 0 : 1;
      const bPrefix = normalizeCommand(b.label).startsWith(normalizedQuery) ? 0 : 1;
      return aPrefix - bPrefix;
    });

    return results.slice(0, 5);
  }, [input, enabled, context.monsterNames, context.deadMonsterNames, context.sendableMonsterNames]);
}
