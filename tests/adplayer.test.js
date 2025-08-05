describe('AdPlayer Integration Tests', () => {
  let page;

  beforeAll(async () => {
    page = await browser.newPage();
    // Mock google.ima before loading the page
    await page.evaluateOnNewDocument(() => {
      window.google = {
        ima: {
          AdDisplayContainer: class { constructor() {} initialize() {} },
          AdsLoader: class {
            constructor() {}
            addEventListener() {}
            requestAds() {}
          },
          AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: 'adsManagerLoaded' } },
          AdErrorEvent: { Type: { AD_ERROR: 'adError' } },
          AdEvent: { Type: { STARTED: 'started', AD_PROGRESS: 'adProgress', ALL_ADS_COMPLETED: 'allAdsCompleted' } },
          ViewMode: { FULLSCREEN: 'fullscreen' },
        },
      };
    });
    await page.goto('http://localhost:8080/index.htm');

    // Wait for the AdPlayer to be initialized
    await page.waitForFunction(() => window.player !== undefined);
  });

  afterAll(async () => {
    await page.close();
  });

  test('AdPlayer should initialize and display elements', async () => {
    // Wait for the ad-container and content-element to be present
    await page.waitForSelector('#ad-container');
    await page.waitForSelector('#content-element');

    const adContainer = await page.$('#ad-container');
    const contentElement = await page.$('#content-element');
    expect(adContainer).not.toBeNull();
    expect(contentElement).not.toBeNull();

    // Wait for the notification container to be present
    await page.waitForSelector('#notification-container');
    const notificationContainer = await page.$('#notification-container');
    expect(notificationContainer).not.toBeNull();

    // Wait for the exposure rate and play request counts elements to be present
    await page.waitForSelector('#exposure-rate');
    await page.waitForSelector('#play-request-counts');
    const exposureRate = await page.$('#exposure-rate');
    const playRequestCounts = await page.$('#play-request-counts');
    expect(exposureRate).not.toBeNull();
    expect(playRequestCounts).not.toBeNull();
  });

  test('Endpoint selection should update and save setting', async () => {
    // Wait for the endpoint selection container and its checkbox to be rendered
    await page.waitForSelector('#endpoint-selection-container input[type="checkbox"]');

    // Click on the first checkbox
    await page.click('#endpoint-selection-container input[type="checkbox"]');

    // Verify that the checkbox is checked
    const isChecked = await page.$eval('#endpoint-selection-container input[type="checkbox"]', checkbox => checkbox.checked);
    expect(isChecked).toBe(true);
  });

  test('Device ID input should update and save setting', async () => {
    await page.waitForSelector('#device-id-input-container input[type="text"]');

    const testDeviceId = 'TEST_DEVICE_ID';
    await page.type('#device-id-input-container input[type="text"]', testDeviceId);

    // Trigger change event
    await page.$eval('#device-id-input-container input[type="text"]', el => el.dispatchEvent(new Event('change')));

    const inputValue = await page.$eval('#device-id-input-container input[type="text"]', input => input.value);
    expect(inputValue).toBe(testDeviceId);
  });

  test('Log toggle should update', async () => {
    await page.waitForSelector('#log-toggle-container input[type="checkbox"]');

    const checkbox = await page.$('#log-toggle-container input[type="checkbox"]');
    await checkbox.click();

    const isChecked = await page.$eval('#log-toggle-container input[type="checkbox"]', cb => cb.checked);
    expect(isChecked).toBe(true);
  });

  test('Show logs button should open log viewer', async () => {
    await page.waitForSelector('#show-logs-button');
    await page.click('#show-logs-button');
    // Wait for the display style to change to flex
    await page.waitForFunction(
      selector => document.querySelector(selector) && getComputedStyle(document.querySelector(selector)).display === 'flex',
      {}, 
      '#log-viewer-container'
    );
    const displayStyle = await page.$eval('#log-viewer-container', el => getComputedStyle(el).display);
    expect(displayStyle).toBe('flex');
  });

  test('Close logs button should close log viewer', async () => {
    await page.waitForSelector('#close-logs-button');
    await page.click('#close-logs-button');
    // Wait for the display style to change to none
    await page.waitForFunction(
      selector => document.querySelector(selector) && getComputedStyle(document.querySelector(selector)).display === 'none',
      {}, 
      '#log-viewer-container'
    );
    const displayStyle = await page.$eval('#log-viewer-container', el => getComputedStyle(el).display);
    expect(displayStyle).toBe('none');
  });
});
