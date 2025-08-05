module.exports = {
  launch: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  server: {
    command: 'npx http-server ./src -p 3000',
    port: 3000,
    launchTimeout: 30000,
  },
};
