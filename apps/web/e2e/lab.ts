import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Helpers for driving the feed lab (`/lab`, src/lab/LabRoute.tsx) from Playwright.
 *
 * Scope every selector to the visible pane: a hidden pane has the same DOM
 * (docs/agents/working-in-this-repo.md, "Live verification").
 */

export type FixtureName = 'quiet-room' | 'duel' | 'brawl' | 'boss' | 'long-session' | 'dev';

export interface OpenOptions {
  /** Events served as history before the page mounts. */
  history?: number;
  theme?: 'phosphor' | 'amber' | 'ember' | 'street-fighter' | 'millefleur';
}

/** Open the lab on a fixture with the control strip hidden, and wait until it has mounted. */
export async function openLab(page: Page, fixture: FixtureName, opts: OpenOptions = {}): Promise<void> {
  const params = new URLSearchParams({ controls: '0' });
  if (opts.history !== undefined) params.set('history', String(opts.history));
  if (opts.theme) params.set('theme', opts.theme);
  await page.goto(`/lab/${fixture}?${params.toString()}`);
  await page.waitForFunction(() => typeof (window as unknown as { __feedLab?: unknown }).__feedLab === 'object');
  await page.evaluate(() => (window as unknown as { __feedLab: { ready(): Promise<void> } }).__feedLab.ready());
}

/** Call a `window.__feedLab` method by name. */
export async function lab<T = unknown>(page: Page, method: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    ([m, a]) => {
      const api = (window as unknown as { __feedLab: Record<string, (...x: unknown[]) => unknown> }).__feedLab;
      return api[m as string]!(...(a as unknown[])) as never;
    },
    [method, args] as const,
  ) as Promise<T>;
}

/** Show a surface by its tab. On a phone only one pane is on screen; the Console is first. */
export async function showSurface(page: Page, name: 'The Ring' | 'Console'): Promise<void> {
  const tab = page.getByRole('tab', { name, exact: true });
  if (await tab.count()) await tab.first().click();
}

/** The visible Ring feed's scroller (Virtuoso's element today; `.event-feed` either way). */
export function ringScroller(page: Page): Locator {
  return page.locator('.event-feed[aria-label="Ring events"]').locator('visible=true');
}

export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  /** Pixels between the viewport's bottom edge and the end of the content. 0 = at the bottom. */
  gap: number;
  /** Pixels between the last rendered row's bottom edge and the scroller's bottom edge. */
  lastRowGap: number | null;
  rows: number;
}

export async function scrollMetrics(scroller: Locator): Promise<ScrollMetrics> {
  return scroller.evaluate((el) => {
    const rows = el.querySelectorAll('.event-feed-list > *');
    const last = rows.length ? (rows[rows.length - 1] as HTMLElement) : null;
    const box = el.getBoundingClientRect();
    return {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      gap: el.scrollHeight - el.scrollTop - el.clientHeight,
      lastRowGap: last ? last.getBoundingClientRect().bottom - box.bottom : null,
      rows: rows.length,
    };
  });
}

/** Wait until scrollTop and scrollHeight have not changed for `quietMs`. */
export async function settle(scroller: Locator, quietMs = 400, timeoutMs = 8_000): Promise<ScrollMetrics> {
  const page = scroller.page();
  const deadline = Date.now() + timeoutMs;
  let last = await scrollMetrics(scroller);
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    await page.waitForTimeout(50);
    const now = await scrollMetrics(scroller);
    if (now.scrollTop !== last.scrollTop || now.scrollHeight !== last.scrollHeight) stableSince = Date.now();
    last = now;
    if (Date.now() - stableSince >= quietMs) return now;
  }
  return last;
}

/** Record a measured number on the test, so the report carries pixels and not only pass/fail. */
export function measure(name: string, value: number, unit = 'px'): void {
  expect.soft(Number.isFinite(value), `${name} is a number`).toBe(true);
  // Annotations land in the JSON report, where the baseline table is built from them.
  test.info().annotations.push({ type: 'measure', description: `${name}=${Math.round(value * 10) / 10}${unit}` });
}
