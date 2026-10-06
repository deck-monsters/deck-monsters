import { useEffect } from 'react';

/** The surfaces that have a painted ground of their own (the Millefleur samples). */
export type PaintSurface = 'ring' | 'workshop' | 'chat';

/**
 * Names the surface on screen as `<html data-paint="…">`, so a painted theme can put that
 * surface's watercolour behind everything, the header included, as its mock does. Only
 * Millefleur reads the attribute; it is inert in the other themes. The Terminal sets it from the
 * visible tab or panes, and the Workshop and Chat full-page routes from their own route; it is
 * removed on unmount, which leaves the default (the Ring's paint).
 */
export function usePaintSurface(surface: PaintSurface | null): void {
  useEffect(() => {
    if (!surface) return undefined;
    const root = document.documentElement;
    root.dataset.paint = surface;
    return () => {
      if (root.dataset.paint === surface) delete root.dataset.paint;
    };
  }, [surface]);
}
