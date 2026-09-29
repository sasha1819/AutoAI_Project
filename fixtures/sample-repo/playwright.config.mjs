import { defineConfig } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "tests",
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: "npm start",
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
  },
});
