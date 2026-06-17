const { test, expect } = require('@playwright/test');

async function forceNoFrontendDefaults(page) {
  await page.route('**/settings/tud_settings.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: `
const TUD_SETTINGS = {
  API_BASE_URL: 'http://localhost:8000/tud_backend/api',
  DEFAULT_STUDY_NAME: null,
  DEFAULT_STUDIES_FILE: null,
  SHOW_PREVIOUS_DAYS_BUTTONS: true
};
window.TUD_SETTINGS = TUD_SETTINGS;
`,
    });
  });
}

test.describe('No studies available without frontend defaults', () => {
  test('shows no-studies error when backend is unreachable', async ({ page }) => {
    await forceNoFrontendDefaults(page);

    await page.route('**/tud_backend/api/active_open_study_names', async (route) => {
      await route.abort('failed');
    });

    await page.goto('index.html', { waitUntil: 'domcontentloaded' });

    const noStudiesMessage = page.locator('.no-studies-message');
    await expect(noStudiesMessage).toBeVisible();
    await expect(noStudiesMessage).toContainText(/No studies available/i);

    const footerStatus = page.locator('#footer_backend_status');
    await expect(footerStatus).toContainText(/No studies available/i);
  });

  test('shows no-studies error when backend returns an empty studies list', async ({ page }) => {
    await forceNoFrontendDefaults(page);

    await page.route('**/tud_backend/api/active_open_study_names', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('index.html', { waitUntil: 'domcontentloaded' });

    const noStudiesMessage = page.locator('.no-studies-message');
    await expect(noStudiesMessage).toBeVisible();
    await expect(noStudiesMessage).toContainText(/No studies available/i);

    const footerStatus = page.locator('#footer_backend_status');
    await expect(footerStatus).toContainText(/No studies available/i);
  });
});
