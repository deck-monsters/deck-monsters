import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useInlineSprites } from '../hooks/useInlineSprites.js';

const render = vi.fn(() => 'sprite');

describe('useInlineSprites', () => {
  it('never loads the sprite chunk for a player who opted out', async () => {
    const loader = vi.fn(async () => ({ renderInlineSprite: render }));
    const { result } = renderHook(() => useInlineSprites(false, loader));

    await Promise.resolve();
    expect(loader).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('hands over the renderer once the chunk arrives, and drops it when turned off', async () => {
    const loader = vi.fn(async () => ({ renderInlineSprite: render }));
    const { result, rerender } = renderHook(({ on }) => useInlineSprites(on, loader), {
      initialProps: { on: true },
    });

    await waitFor(() => expect(result.current).toBe(render));

    rerender({ on: false });
    expect(result.current).toBeNull();
  });

  it('leaves the emoji in place if the chunk fails to load', async () => {
    const loader = vi.fn(async () => { throw new Error('offline'); });
    const { result } = renderHook(() => useInlineSprites(true, loader));

    await waitFor(() => expect(loader).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
