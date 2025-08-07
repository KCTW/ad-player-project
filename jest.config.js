module.exports = {
  preset: "jest-puppeteer",
  testMatch: ["**/tests/**/*.test.js"],
  setupFilesAfterEnv: ["./jest.setup.js"],
  testTimeout: 60000, // 增加測試超時時間到 60 秒
};
