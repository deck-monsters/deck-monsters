import { useMemo } from 'react';
import { COMMAND_CATALOG } from '@deck-monsters/engine';

export interface AutocompleteSuggestion {
  label: string;
  insertValue: string;
}

const MONSTER_COMMAND_RE = /\[monster\]/i;
const ITEM_COMMAND_RE = /\[(?:item|item name)\]/i;

type MonsterAutocompleteContext = {
  monsterNames?: string[];
  deadMonsterNames?: string[];
  sendableMonsterNames?: string[];
  transferableMonsterNames?: string[];
  characterItems?: AutocompleteItem[];
  monsterItems?: Array<{ monsterName: string; items: AutocompleteItem[] }>;
};

export interface AutocompleteItem {
  displayName: string;
  expired: boolean;
  usableOnMonsters: string[];
}

function normalizeCommand(input: string): string {
  return input.replace(/\s+/g, ' ').trim().toLowerCase();
}

function expandMonsterPlaceholder(command: string, monsterName: string): string {
  return command.replace(/\[monster\]/gi, monsterName);
}

function expandItemPlaceholder(command: string, itemName: string): string {
  return command.replace(/\[(?:item|item name)\]/gi, itemName);
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
    const transferableMonsterNames = context.transferableMonsterNames ?? monsterNames;
    const characterItems = (context.characterItems ?? []).filter(item => !item.expired);
    const monsterItems = context.monsterItems ?? [];

    for (const entry of COMMAND_CATALOG) {
      const hasMonsterPlaceholder = MONSTER_COMMAND_RE.test(entry.command);
      let namesForTemplate = monsterNames;
      if (/^revive \[monster\]$/i.test(entry.command)) {
        namesForTemplate = deadMonsterNames;
      } else if (/^send \[monster\] to the ring$/i.test(entry.command)) {
        namesForTemplate = sendableMonsterNames;
      }
      const monsterCommands = hasMonsterPlaceholder && monsterNames.length > 0
        ? namesForTemplate.map((name) => ({
            label: expandMonsterPlaceholder(entry.command, name),
            insertValue: expandMonsterPlaceholder(entry.command, name),
          }))
        : [{
            label: entry.command,
            insertValue: entry.command.replace(/\[monster\]/gi, '').replace(/\s+/g, ' ').trimEnd(),
          }];
      let itemCandidates: Array<{ itemName: string; monsterName?: string }> = [];
      if (/^give \[item\] to \[monster\]$/i.test(entry.command)) {
        itemCandidates = characterItems.flatMap(item => transferableMonsterNames.map(monsterName => ({ itemName: item.displayName, monsterName })));
      } else if (/^take \[item\] from \[monster\]$/i.test(entry.command)) {
        itemCandidates = monsterItems.filter(source => transferableMonsterNames.includes(source.monsterName)).flatMap(source => source.items
          .filter(item => !item.expired)
          .map(item => ({ itemName: item.displayName, monsterName: source.monsterName })));
      } else if (/^use \[item\] on \[monster\]$/i.test(entry.command)) {
        itemCandidates = [
          ...characterItems.flatMap(item => item.usableOnMonsters.map(monsterName => ({ itemName: item.displayName, monsterName }))),
          ...monsterItems.flatMap(source => source.items
            .filter(item => !item.expired && item.usableOnMonsters.includes(source.monsterName))
            .map(item => ({ itemName: item.displayName, monsterName: source.monsterName }))),
        ];
      } else if (ITEM_COMMAND_RE.test(entry.command)) {
        const allItems = [...characterItems, ...monsterItems.flatMap(source => source.items)].filter(item => !item.expired);
        itemCandidates = allItems.map(item => ({ itemName: item.displayName }));
      }

      const expandedCommands = ITEM_COMMAND_RE.test(entry.command) && itemCandidates.length > 0
        ? itemCandidates.map(({ itemName, monsterName }) => {
            const command = monsterName ? expandMonsterPlaceholder(entry.command, monsterName) : entry.command;
            return {
              label: expandItemPlaceholder(command, itemName),
              insertValue: expandItemPlaceholder(command, itemName),
            };
          })
        : monsterCommands.map(candidate => ({
            ...candidate,
            insertValue: candidate.insertValue
              .replace(/\[.*?\]/g, '')
              .replace(/\s+/g, ' ')
              .trimEnd(),
          }));

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
  }, [input, enabled, context.monsterNames, context.deadMonsterNames, context.sendableMonsterNames, context.transferableMonsterNames, context.characterItems, context.monsterItems]);
}
