const { test, expect } = require('@playwright/test');

test('footer shows study-specific links configured in studies_config', async ({
  page,
}) => {
  await page.goto('index.html?study_name=default&lang=en', {
    waitUntil: 'domcontentloaded',
  });

  // Should redirect to instructions first
  await expect(page).toHaveURL(/pages\/instructions\.html/);
  await expect(page.locator('#continueBtn')).toBeVisible();

  // Enter the study
  await page.locator('#continueBtn').click();
  await page.waitForURL(/index\.html/, { timeout: 15000 });

  // Wait for study config to be fully initialized (tud:studyConfigReady fired)
  await page.waitForFunction(
    () => window.TUD_STUDY_CONFIG && window.TUD_STUDY_CONFIG.footer_links,
    { timeout: 20000 }
  );

  // Now check that the study-specific footer links are rendered inside #footer
  const footer = page.locator('#footer');
  await expect(footer).toBeVisible();

  const studyInfoLink = footer.locator('a[href="https://example.com/study-info"]');
  await expect(studyInfoLink).toBeVisible();
  await expect(studyInfoLink).toContainText('Study Information');
  // The "opens elsewhere" hint is a decoration; the accessible name carries it.
  await expect(studyInfoLink.locator('[aria-hidden="true"]')).toHaveText('↗');
  // External targets open in a new tab (the diary page must survive), and the
  // accessible name says so - a new tab is a change of context.
  await expect(studyInfoLink).toHaveAttribute('target', '_blank');
  await expect(studyInfoLink).toHaveAttribute('rel', /noopener/);
  await expect(studyInfoLink).toHaveAttribute(
    'aria-label',
    'Study Information (opens in a new tab)'
  );

  // There is no per-link new-tab flag any more: the Contact link used to ask for
  // the same tab, which navigated the participant out of the study. It now
  // behaves like any other external link.
  const contactLink = footer.locator('a[href="https://example.com/contact"]');
  await expect(contactLink).toBeVisible();
  await expect(contactLink).toContainText('Contact');
  await expect(contactLink).toHaveAttribute('target', '_blank');
});

test('a same-origin footer link opens in a dialog, not in a new page', async ({
  page,
}) => {
  // The dialog is for our own content: a study can point target_url at a page on
  // this server, and then nothing navigates at all. The response is extended
  // rather than replaced so this stays true whatever the fixture study contains.
  await page.route('**/study-config*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.footer_links = [
      ...(body.footer_links || []),
      {
        title: { en: 'Study Details', de: 'Studiendetails' },
        // Any same-origin target proves the mechanism; a JSON file keeps the
        // frame free of a second copy of the app.
        target_url: 'settings/studies_config.json',
      },
    ];
    await route.fulfill({ response, json: body });
  });

  await page.goto('index.html?study_name=default&lang=en', {
    waitUntil: 'domcontentloaded',
  });
  await expect(page).toHaveURL(/pages\/instructions\.html/);
  await page.locator('#continueBtn').click();
  await page.waitForURL(/index\.html/, { timeout: 15000 });

  const link = page.locator('#footer a[href="settings/studies_config.json"]');
  await expect(link).toBeVisible({ timeout: 20000 });
  await expect(link, 'a same-origin link must not ask for a new tab').not.toHaveAttribute(
    'target',
    '_blank'
  );

  const urlBefore = page.url();
  await link.click();

  const dialog = page.locator('#footerLinkModal');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('role', 'dialog');
  await expect(
    dialog.locator('iframe[src="settings/studies_config.json"]')
  ).toHaveCount(1);
  expect(
    page.url(),
    'showing our own page must not navigate the participant away'
  ).toBe(urlBefore);

  // Escape closes it and focus returns to the link that opened it.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(page.url()).toBe(urlBefore);
  await expect(link).toBeFocused();
});
