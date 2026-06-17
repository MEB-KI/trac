const { test, expect } = require('@playwright/test');

test.describe('No studies available without frontend defaults', () => {
  test('shows no-studies error when backend is unreachable', async ({ page }) => {
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
