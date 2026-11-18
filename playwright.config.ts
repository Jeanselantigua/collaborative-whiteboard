import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:5173",
    // shortcut: runs in the Edge that ships with Windows to skip a browser
    // download. Remove this line and run `npx playwright install` for CI.
    channel: "msedge",
  },
  webServer: {
    command: "npm run dev -w client",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
