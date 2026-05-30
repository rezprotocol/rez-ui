export default {
  testDir: "./test/e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    browserName: "chromium",
    channel: "chrome",
    headless: true,
  },
};
