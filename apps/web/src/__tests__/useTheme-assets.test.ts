import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * `themeAssetsReady` gates the Ring's first measurement on a lazy theme's stylesheet. It
 * must be false before the chunk lands, true after, and stay false (so a later apply
 * retries) when the import rejects or never settles.
 */
async function freshUseTheme(factory: () => unknown | Promise<unknown>) {
  vi.resetModules();
  vi.doMock('../themes/millefleur.js', factory as () => never);
  return import('../hooks/useTheme.js');
}

describe('themeAssetsReady', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('is always ready for a theme with no chunk', async () => {
    const mod = await freshUseTheme(() => ({}));
    expect(mod.themeAssetsReady('amber')).toBe(true);
  });

  it('is not ready before the chunk loads, ready after, and tells subscribers', async () => {
    const mod = await freshUseTheme(() => ({}));
    const landed = vi.fn();
    mod.subscribeThemeAssets(landed);
    expect(mod.themeAssetsReady('millefleur')).toBe(false);
    await mod.loadThemeAssets('millefleur');
    await Promise.resolve();
    expect(mod.themeAssetsReady('millefleur')).toBe(true);
    expect(landed).toHaveBeenCalledWith('millefleur');
  });

  it('stays not ready when the import rejects, and a later apply retries', async () => {
    let attempts = 0;
    const mod = await freshUseTheme(() => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return {};
    });
    const landed = vi.fn();
    mod.subscribeThemeAssets(landed);
    await mod.loadThemeAssets('millefleur'); // resolves after the failure is logged
    await Promise.resolve();
    expect(mod.themeAssetsReady('millefleur')).toBe(false);
    expect(landed).not.toHaveBeenCalled();
    await mod.loadThemeAssets('millefleur');
    await Promise.resolve();
    expect(mod.themeAssetsReady('millefleur')).toBe(true);
    expect(landed).toHaveBeenCalledTimes(1);
  });

  it('stays not ready while the import never settles', async () => {
    const mod = await freshUseTheme(() => new Promise(() => undefined));
    void mod.loadThemeAssets('millefleur');
    await Promise.resolve();
    expect(mod.themeAssetsReady('millefleur')).toBe(false);
  });
});
