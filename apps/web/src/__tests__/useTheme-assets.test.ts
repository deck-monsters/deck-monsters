import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * A lazy theme's chunk is imported once, shared by every caller, and retried by a later apply
 * when the import fails (a failed import must not be cached as a success).
 */
async function freshUseTheme(factory: () => unknown | Promise<unknown>) {
  vi.resetModules();
  vi.doMock('../themes/millefleur.js', factory as () => never);
  return import('../hooks/useTheme.js');
}

describe('loadThemeAssets', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('has nothing to load for a theme with no chunk', async () => {
    const mod = await freshUseTheme(() => ({}));
    await expect(mod.loadThemeAssets('amber')).resolves.toBeUndefined();
  });

  it('shares one import between callers', async () => {
    let imports = 0;
    const mod = await freshUseTheme(() => {
      imports += 1;
      return {};
    });
    await Promise.all([mod.loadThemeAssets('millefleur'), mod.loadThemeAssets('millefleur')]);
    await mod.loadThemeAssets('millefleur');
    expect(imports).toBe(1);
  });

  it('logs a failed import and retries on the next apply', async () => {
    let attempts = 0;
    const mod = await freshUseTheme(() => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return {};
    });
    await mod.loadThemeAssets('millefleur');
    expect(console.error).toHaveBeenCalled();
    await mod.loadThemeAssets('millefleur');
    expect(attempts).toBe(2);
    await mod.loadThemeAssets('millefleur');
    expect(attempts).toBe(2);
  });
});
