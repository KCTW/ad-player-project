describe('Minimal Admin Page Test', () => {
  beforeEach(async () => {
    console.log('Executing beforeEach for minimal.test.js');
    await page.goto('http://localhost:8081/admin.htm', { timeout: 90000 });
  });

  test('should display "廣告播放器管理後台" as the title', async () => {
    const title = await page.title();
    expect(title).toBe('廣告播放器管理後台');
  });
});