import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PlainFeedList from '../components/PlainFeedList.js';

/**
 * The window rules that need no layout (jsdom has none): how many rows are drawn on the first
 * paint, how the older ones are backfilled, and that following trims to `cap`. The pin and
 * unpin rules depend on real sizes and are proved in a browser (e2e/scroll.spec.ts).
 */
const rows = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: `r${from + i}` }));

function List({ data, cap }: { data: { id: string }[]; cap?: number }) {
  return (
    <PlainFeedList
      data={data}
      rowKey={(r) => r.id}
      renderRow={(_, r) => <li>{r.id}</li>}
      empty={<p>nothing</p>}
      pane="test"
      ariaLabel="Test feed"
      {...(cap ? { cap } : {})}
    />
  );
}

const drawn = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('[data-item-index]')).map((el) => Number(el.getAttribute('data-item-index')));

describe('PlainFeedList window', () => {
  it('draws only the newest rows on the first paint, then backfills the rest above', async () => {
    const { container } = render(<List data={rows(100)} />);
    // Synchronously after mount: the newest 24 only.
    expect(drawn(container)).toEqual(Array.from({ length: 24 }, (_, i) => 76 + i));
    await waitFor(() => expect(drawn(container)).toHaveLength(100));
    expect(drawn(container)[0]).toBe(0);
    expect(drawn(container)[99]).toBe(99);
  });

  it('keeps only the newest `cap` rows while following, however many arrive', async () => {
    const { container, rerender } = render(<List data={rows(40)} cap={50} />);
    await waitFor(() => expect(drawn(container)).toHaveLength(40));
    act(() => rerender(<List data={rows(80)} cap={50} />));
    await waitFor(() => expect(drawn(container)).toHaveLength(50));
    expect(drawn(container)[0]).toBe(30);
    expect(drawn(container)[49]).toBe(79);
    expect(container.textContent).toContain('r79');
    expect(container.textContent).not.toContain('r29');
  });

  it('shows the empty state when there are no rows', () => {
    const { container } = render(<List data={[]} />);
    expect(container.textContent).toBe('nothing');
  });
});
