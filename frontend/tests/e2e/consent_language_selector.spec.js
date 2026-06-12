const { test, expect } = require('@playwright/test');

test('consent page shows language selector for default study', async ({ page }) => {
  await page.goto('pages/consent.html?study_name=default', {
    waitUntil: 'domcontentloaded',
  });

  const selector = page.locator('#consentLanguageSelector');
  await expect(selector).toBeVisible();

  const options = await selector.locator('option').allTextContents();
  // Expect at least these language short codes uppercased
  expect(options).toEqual(expect.arrayContaining(['EN', 'SV', 'DE']));
});
