// A config whose browser project depends on a login setup project and its saved session, a common Playwright
// pattern that AutoAI does not run yet (docs/LATER.md).
const port = 4174;

export default {
  testDir: "tests",
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: "npm start",
    url: `http://localhost:${port}`,
    env: { PORT: String(port) },
  },
  projects: [
    { name: "login", testMatch: /login\.setup\.ts/ },
    {
      name: "chromium",
      use: { browserName: "chromium", storageState: "playwright/.auth/user.json" },
      dependencies: ["login"],
    },
  ],
};
