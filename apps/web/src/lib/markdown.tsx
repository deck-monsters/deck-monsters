import { Fragment, type ReactNode } from 'react';

/**
 * DELIBERATELY SUPPORTS ONLY WHAT THE GENERATED GUIDES USE. `markdown.guides.test.tsx` renders
 * the four real guides and fails if raw Markdown leaks through, so a generator change that
 * adds new syntax shows up there rather than in a player's browser.
 *
 * A deliberately small Markdown renderer for the generated guides at the repo root
 * (PLAYER_HANDBOOK.md, MONSTERS.md, CARDS.md, ITEMS.md — see
 * `packages/engine/src/build/markdown.ts`). It supports only the shapes those files use:
 * headings, paragraphs, bullet/numbered lists (with indented continuation blocks), fenced
 * code, tables, blockquotes, rules, and inline code / bold / italic / links.
 *
 * Why not a library: no Markdown package was already in the workspace, the input is our
 * own generated text (not user content), and this renders React elements rather than HTML
 * strings, so nothing here can inject markup. If a guide starts using a shape this does
 * not know, it falls back to a plain paragraph instead of dropping text.
 */

/** Matches the engine's `slugify` so the guides' own `[x](#x)` contents links resolve. */
export const slugify = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');

export interface MarkdownLinkHandlers {
  /** Called for a link to another guide, e.g. `[ITEMS.md](ITEMS.md)`. Return false to render plain text. */
  onGuideLink?: (file: string) => void;
  /** Filenames onGuideLink understands. */
  guideFiles?: readonly string[];
}

interface Ctx extends MarkdownLinkHandlers {
  /** Added to every heading level so a guide's `#` sits under the page's own `h1`. */
  headingOffset: number;
  seenIds: Map<string, number>;
  keyPrefix: string;
}

const BLOCK_START = /^(\s{0,3}#{1,6}\s|\s*```|\s*>|\s*\|.*\|\s*$|\s*([-*]|\d+\.)\s+|\s*---+\s*$)/;

function scrollToId(id: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView?.({ block: 'start' });
    el.focus?.({ preventScroll: true });
  }
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*\s][^*]*\*)|(\b_[^_\s][^_]*_\b)/;

function renderInline(text: string, ctx: Ctx, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const tok = m[0];
    const key = `${keyBase}-${n++}`;
    if (m[1]) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key}>{renderInline(tok.slice(2, -2), ctx, key)}</strong>);
    else if (m[3]) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!;
      const label = renderInline(link[1]!, ctx, key);
      const href = link[2]!;
      if (href.startsWith('#')) {
        const id = href.slice(1);
        out.push(
          <a key={key} href={href} onClick={(e) => { e.preventDefault(); scrollToId(id); }}>{label}</a>,
        );
      } else if (ctx.guideFiles?.includes(href) && ctx.onGuideLink) {
        out.push(
          <a key={key} href={href} onClick={(e) => { e.preventDefault(); ctx.onGuideLink?.(href); }}>{label}</a>,
        );
      } else if (/^https?:\/\//.test(href)) {
        out.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer">{label}</a>);
      } else {
        out.push(<Fragment key={key}>{label}</Fragment>);
      }
    } else out.push(<em key={key}>{renderInline(tok.slice(1, -1), ctx, key)}</em>);
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

const isTableSep = (line: string | undefined): boolean => !!line && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes('-');

function parseBlocks(lines: string[], ctx: Ctx): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  const k = () => `${ctx.keyPrefix}${out.length}`;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) { i++; continue; }

    const fence = /^\s*```/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) body.push(lines[i++]!);
      i++;
      // Scrolls inside its own box (ASCII art is wider than a phone) and is focusable so a
      // keyboard user can scroll it.
      out.push(<pre key={k()} className="help-pre" tabIndex={0}><code>{body.join('\n')}</code></pre>);
      continue;
    }

    const h = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const level = Math.min(6, h[1]!.length + ctx.headingOffset);
      const text = h[2]!;
      let id = slugify(text.replace(/[`*]/g, ''));
      const seen = ctx.seenIds.get(id) ?? 0;
      ctx.seenIds.set(id, seen + 1);
      if (seen > 0) id = `${id}-${seen}`;
      const Tag = `h${level}` as 'h2';
      // tabIndex -1: contents links move focus to the heading they scroll to.
      out.push(<Tag key={k()} id={id} tabIndex={-1}>{renderInline(text, ctx, k())}</Tag>);
      i++;
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) { out.push(<hr key={k()} />); i++; continue; }

    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]!)) body.push(lines[i++]!.replace(/^\s*>\s?/, ''));
      out.push(<blockquote key={k()}>{parseBlocks(body, { ...ctx, keyPrefix: `${k()}-` })}</blockquote>);
      continue;
    }

    if (/^\s*\|/.test(line) && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i]!)) rows.push(splitRow(lines[i++]!));
      const key = k();
      // The wrapper — not the page — scrolls sideways at 390px. Focusable + labelled so
      // keyboard users can scroll it (same pattern as the leaderboard tables).
      out.push(
        <div key={key} className="help-table-region" role="region" aria-label={`Table: ${head.join(', ')}`} tabIndex={0}>
          <table>
            <thead><tr>{head.map((c, ci) => <th key={ci} scope="col">{renderInline(c, ctx, `${key}h${ci}`)}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci}>{renderInline(c, ctx, `${key}r${ri}c${ci}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      const ordered = /\d/.test(li[2]!);
      const items: ReactNode[] = [];
      const key = k();
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]!);
        if (!m || /\d/.test(m[2]!) !== ordered || m[1]!.length > li[1]!.length) break;
        const body: string[] = [m[3]!];
        i++;
        // Continuation: indented lines, and blank lines that are followed by indented ones.
        while (i < lines.length) {
          const next = lines[i]!;
          if (/^\s+\S/.test(next) && next.search(/\S/) > li[1]!.length) body.push(next.replace(/^\s{1,3}/, ''));
          else if (!next.trim() && /^\s+\S/.test(lines[i + 1] ?? '') && (lines[i + 1] ?? '').search(/\S/) > li[1]!.length) body.push('');
          else break;
          i++;
        }
        // A blank line between items keeps them one list.
        while (i < lines.length && !lines[i]!.trim() && /^\s*([-*]|\d+\.)\s+/.test(lines[i + 1] ?? '')) i++;
        items.push(<li key={items.length}>{parseBlocks(body, { ...ctx, keyPrefix: `${key}-${items.length}-` })}</li>);
      }
      const List = ordered ? 'ol' : 'ul';
      out.push(<List key={key}>{items}</List>);
      continue;
    }

    // Paragraph: consecutive non-blank lines that don't open another block.
    const para: string[] = [line.trim()];
    i++;
    while (i < lines.length && lines[i]!.trim() && !BLOCK_START.test(lines[i]!)) para.push(lines[i++]!.trim());
    out.push(<p key={k()}>{renderInline(para.join(' '), ctx, k())}</p>);
  }
  return out;
}

export interface MarkdownProps extends MarkdownLinkHandlers {
  source: string;
  /** Shift heading levels down (1 turns `#` into `h2`). Default 1. */
  headingOffset?: number;
}

export function renderMarkdown(source: string, opts: Omit<MarkdownProps, 'source'> = {}): ReactNode[] {
  const ctx: Ctx = {
    headingOffset: opts.headingOffset ?? 1,
    seenIds: new Map(),
    keyPrefix: 'b',
    onGuideLink: opts.onGuideLink,
    guideFiles: opts.guideFiles,
  };
  return parseBlocks(source.replace(/\r\n/g, '\n').split('\n'), ctx);
}

/** The line every generated guide opens with ("Generated from ... do not edit"); it is a
 * note for people editing the repo, not for players. */
export function stripGeneratedNotice(source: string): string {
  return source.replace(/^> Generated from .*\n?/m, '');
}

export default function Markdown({ source, ...opts }: MarkdownProps) {
  return <>{renderMarkdown(source, opts)}</>;
}
