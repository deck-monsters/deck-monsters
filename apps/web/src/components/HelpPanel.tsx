import { useRef, useState, type ReactNode } from 'react';
import { COMMAND_CATALOG } from '@deck-monsters/engine';
import handbook from '../../../../PLAYER_HANDBOOK.md?raw';
import monsters from '../../../../MONSTERS.md?raw';
import cards from '../../../../CARDS.md?raw';
import items from '../../../../ITEMS.md?raw';
import Markdown, { stripGeneratedNotice } from '../lib/markdown.js';
import { CATEGORY_LABELS, CATEGORY_ORDER } from './CommandReference.js';

/**
 * Help and guides (roadmap 39). The guide text is the generated Markdown at the repo root,
 * bundled at build time with Vite's `?raw` import — no endpoint, no fetch. Editing the
 * generator and running `pnpm run build:docs` refreshes what players read here on the next
 * web build. The Commands section reads `COMMAND_CATALOG`, the same data the Console's
 * command reference shows, so the two cannot drift.
 * See docs/architecture/web-workspace.md.
 */

interface HelpPanelProps { headerActions?: ReactNode }

type SectionId = 'how-to-play' | 'monsters' | 'cards' | 'items' | 'commands';

interface Section {
  id: SectionId;
  label: string;
  /** Repo-root filename, so guides' cross-links (`[ITEMS.md](ITEMS.md)`) can switch section. */
  file?: string;
  markdown?: string;
}

const SECTIONS: Section[] = [
  { id: 'how-to-play', label: 'How to play', file: 'PLAYER_HANDBOOK.md', markdown: handbook },
  { id: 'monsters', label: 'Monsters', file: 'MONSTERS.md', markdown: monsters },
  { id: 'cards', label: 'Cards', file: 'CARDS.md', markdown: cards },
  { id: 'items', label: 'Items', file: 'ITEMS.md', markdown: items },
  { id: 'commands', label: 'Commands' },
];

const GUIDE_FILES = SECTIONS.flatMap((s) => (s.file ? [s.file] : []));

function CommandsSection() {
  return (
    <div className="help-guide">
      <h2>Commands</h2>
      {CATEGORY_ORDER.map((cat) => {
        const entries = COMMAND_CATALOG.filter((e) => e.category === cat);
        if (!entries.length) return null;
        return (
          <section key={cat} aria-labelledby={`help-cmd-${cat}`}>
            <h3 id={`help-cmd-${cat}`}>{CATEGORY_LABELS[cat]}</h3>
            <div className="help-table-region" role="region" aria-label={`Table: ${CATEGORY_LABELS[cat]} commands`} tabIndex={0}>
              <table>
                <thead><tr><th scope="col">Command</th><th scope="col">What it does</th></tr></thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.command}>
                      <td><code>{entry.command}</code></td>
                      <td>
                        {entry.description}
                        {entry.example && <div className="help-example">eg: <code>{entry.example}</code></div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function HelpPanel({ headerActions }: HelpPanelProps) {
  const [active, setActive] = useState<SectionId>('how-to-play');
  const bodyRef = useRef<HTMLDivElement>(null);
  const section = SECTIONS.find((s) => s.id === active)!;

  function show(id: SectionId) {
    setActive(id);
    bodyRef.current?.scrollTo?.({ top: 0 });
  }

  const guide = section.markdown === undefined ? null : (
    <div className="help-guide">
      <Markdown
        source={stripGeneratedNotice(section.markdown)}
        guideFiles={GUIDE_FILES}
        onGuideLink={(file) => {
          const target = SECTIONS.find((s) => s.file === file);
          if (target) show(target.id);
        }}
      />
    </div>
  );

  return (
    <div className="surface-panel-host">
      <section className="surface-panel help-panel" ref={bodyRef} aria-labelledby="help-title">
        <header className="surface-panel-heading">
          <h1 id="help-title">Help and guides</h1>
          <div className="surface-panel-actions">{headerActions}</div>
        </header>
        <p className="surface-muted">Everything the game does, written down. New here? Start with How to play.</p>
        <nav className="help-sections" aria-label="Help sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="btn"
              aria-pressed={s.id === active}
              onClick={() => show(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        {section.id === 'commands' ? <CommandsSection /> : guide}
      </section>
    </div>
  );
}
