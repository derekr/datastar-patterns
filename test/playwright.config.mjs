import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 60000,
  fullyParallel: false, // specs share Service Worker registrations: run serially
  use: {
    baseURL: 'http://localhost:9271',
    trace: 'retain-on-failure',
  },
  webServer: {
    // Serves the repo root (static, no build). Reuses the dev server if up.
    command: 'python3 -m http.server 9271',
    url: 'http://localhost:9271/index.html',
    reuseExistingServer: true,
    cwd: '..',
    timeout: 10000,
  },
});
