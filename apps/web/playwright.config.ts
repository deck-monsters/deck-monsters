import { defineConfig, devices } from '@playwright/test';

/*
 * Real-browser tests over the feed lab (`/lab`, src/lab): the real room UI on a scripted
 * transport, with no server. jsdom has no layout, so nothing under `src/__tests__` can tell
 * whether a feed ends up where it should; these can. See docs/roadmap/52.
 *
 * The server is the production build under `vite preview`, not the dev server: StrictMode's
 * double effects and unbundled modules change both timing and the subscription count.
 * The Supabase values are dummies; `lib/supabase.ts` throws without them and the lab never
 * calls out.
 *
 * WebKit is not installed everywhere (agent containers ship Chromium only). Set
 * `E2E_WEBKIT=1` where it is, as CI does.
 */
const PORT = Number(process.env['E2E_PORT'] ?? 5198);
const withWebkit = process.env['E2E_WEBKIT'] === '1';

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'e2e/.results/report.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-phone', use: { ...devices['Desktop Chrome'], ...phone } },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], ...desktop } },
    ...(withWebkit
      ? [
          { name: 'webkit-phone', use: { ...devices['Desktop Safari'], ...phone } },
          { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], ...desktop } },
        ]
      : []),
  ],
  webServer: {
    command: `pnpm exec vite build && pnpm exec vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/lab`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:9',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_lab',
    },
  },
});
