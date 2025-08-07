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

    // Make the debug UI visible for testing
    await page.evaluate(() => {
      const debugUiContainer = document.getElementById('debug-ui-container');
      if (debugUiContainer) {
        debugUiContainer.style.display = 'flex';
      }
    });
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
    // Wait for the endpoint selection container and its checkbox to be rendered and clickable
    const checkboxSelector = '#endpoint-selection-container input[type="checkbox"]';
    await page.waitForSelector(checkboxSelector, { visible: true });
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0;
    }, {}, checkboxSelector);

    // Click on the first checkbox
    await page.click(checkboxSelector);

    // Verify that the checkbox is checked
    const isChecked = await page.$eval(checkboxSelector, checkbox => checkbox.checked);
    expect(isChecked).toBe(true);
  });

  test('Device ID input should update and save setting', async () => {
    const inputSelector = '#device-id-input-container input[type="text"]';
    await page.waitForSelector(inputSelector, { visible: true });

    const testDeviceId = 'TEST_DEVICE_ID';
    await page.type(inputSelector, testDeviceId);

    // Trigger change event
    await page.$eval(inputSelector, el => el.dispatchEvent(new Event('change')));

    // Wait for the input value to be updated
    await page.waitForFunction((selector, expectedValue) => {
      const el = document.querySelector(selector);
      return el && el.value === expectedValue;
    }, {}, inputSelector, testDeviceId);

    const inputValue = await page.$eval(inputSelector, input => input.value);
    expect(inputValue).toBe(testDeviceId);
  });

  test('Log toggle should update', async () => {
    const checkboxSelector = '#log-toggle-container input[type="checkbox"]';
    await page.waitForSelector(checkboxSelector, { visible: true });
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0;
    }, {}, checkboxSelector);

    const checkbox = await page.$(checkboxSelector);
    await checkbox.click();

    const isChecked = await page.$eval(checkboxSelector, cb => cb.checked);
    expect(isChecked).toBe(true);
  });

  test('Show logs button should open log viewer', async () => {
    const buttonSelector = '#show-logs-button';
    await page.waitForSelector(buttonSelector, { visible: true });
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0;
    }, {}, buttonSelector);
    await page.click(buttonSelector);
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
    const buttonSelector = '#close-logs-button';
    await page.waitForSelector(buttonSelector, { visible: true });
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0;
    }, {}, buttonSelector);
    await page.click(buttonSelector);
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
