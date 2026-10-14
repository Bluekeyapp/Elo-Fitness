import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the production build (so the offline service worker is real),
// served at the same sub-path as GitHub Pages.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/eloisesportapp/',
    ...devices['Pixel 7'],
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/eloisesportapp/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
