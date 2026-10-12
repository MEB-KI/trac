// Consent page failure handling.
//
// Guards the fixes for the production report where a participant saw only
// "could not load the consent information" plus "could not save the consent":
//
//   1. a transient backend failure (restart / 502 / dropped connection) must be
//      retried before the participant sees an error, exactly like the diary
//      page does;
//   2. the page must not offer consent actions when the consent information
//      never loaded (fail closed) - consenting to text nobody saw is worthless;
//   3. permanent failures (broken/expired link, paused study, already
//      submitted) must say so instead of inviting an endless retry.
const { test, expect } = require('@playwright/test');

const STUDY = 'default';
const CONFIG_ROUTE = `**/api/studies/${STUDY}/study-config**`;
const CONSENT_ROUTE = `**/api/studies/${STUDY}/participants/**/consent`;

function consentUrl({ lang = 'en', pid = null } = {}) {
  const params = new URLSearchParams({ study_name: STUDY, lang });
  if (pid) params.set('pid', pid);
  return `pages/consent.html?${params.toString()}`;
}

/**
 * The page auto-accepts consent under `navigator.webdriver` (Playwright reports
 * one), which would navigate away before a test can click. Report as a normal
 * browser so the actions are actually wired.
 * @param {import('@playwright/test').Page} page
 */
async function useRealBrowser(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true,
    });
  });
}

test('a temporary config failure is retried, then consent stays disabled', async ({
  page,
}) => {
  let attempts = 0;
  await page.route(CONFIG_ROUTE, async (route) => {
    attempts += 1;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Service Unavailable' }),
    });
  });

  await page.goto(consentUrl({ lang: 'de' }), {
    waitUntil: 'domcontentloaded',
  });

  // German report text: the participant is asked to reload, and no consent can
  // be given while the information is missing.
  await expect(page.locator('#study-consent-text')).toContainText(
    'Bitte laden Sie die Seite neu',
    { timeout: 20_000 }
  );
  await expect(page.locator('#consentAcceptBtn')).toBeDisabled();
  await expect(page.locator('#consentDeclineBtn')).toBeDisabled();
  await expect(page.locator('#consentCheckbox')).toBeDisabled();

  // 1 initial attempt + 2 retries: a short maintenance restart is survived.
  expect(attempts).toBe(3);
});

test('a rejected participant link is reported as invalid, not as a retryable error', async ({
  page,
}) => {
  await page.route(CONFIG_ROUTE, (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        detail: {
          code: 'study_access_denied',
          message: 'You are not authorized to participate in this study.',
        },
      }),
    })
  );

  await page.goto(consentUrl(), { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#study-consent-text')).toContainText(
    'not valid for this study'
  );
  await expect(page.locator('#consentStatus')).toContainText(
    'not valid for this study'
  );
  await expect(page.locator('#consentAcceptBtn')).toBeDisabled();
});

test('a paused or closed study is reported as currently unavailable', async ({
  page,
}) => {
  await page.route(CONFIG_ROUTE, (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        detail: {
          code: 'study_unavailable',
          message: 'Diese Studie ist momentan nicht verfügbar.',
        },
      }),
    })
  );

  await page.goto(consentUrl(), { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#study-consent-text')).toContainText(
    'currently not available'
  );
  await expect(page.locator('#consentAcceptBtn')).toBeDisabled();
});

test('an unknown study keeps the consent actions hidden', async ({ page }) => {
  await page.route(CONFIG_ROUTE, (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: `Study '${STUDY}' not found` }),
    })
  );

  await page.goto(consentUrl(), { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#study-consent-text')).toContainText(
    'does not exist'
  );
  await expect(page.locator('#consentAcceptBtn')).toBeHidden();
  await expect(page.locator('#consentDeclineBtn')).toBeHidden();
});

test('a rejected consent save does not invite an endless retry', async ({
  page,
}) => {
  await useRealBrowser(page);
  await page.route(CONSENT_ROUTE, (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        detail: `Participant not authorized for this study`,
      }),
    })
  );

  await page.goto(consentUrl({ pid: 'someone-not-listed' }), {
    waitUntil: 'domcontentloaded',
  });

  // The config itself loads (this study allows unlisted participants), so the
  // page is usable - only the save is rejected.
  const checkbox = page.locator('#consentCheckbox');
  await expect(checkbox).toBeEnabled();
  await checkbox.check();
  await page.locator('#consentAcceptBtn').click();

  await expect(page.locator('#consentStatus')).toContainText(
    'contact the study team'
  );
  // Retrying cannot help, so the page stops offering the actions.
  await expect(page.locator('#consentAcceptBtn')).toBeDisabled();
  await expect(page.locator('#consentDeclineBtn')).toBeDisabled();
  await expect(checkbox).toBeDisabled();
});

test('a temporary consent save failure is retried and stays retryable', async ({
  page,
}) => {
  await useRealBrowser(page);
  let attempts = 0;
  await page.route(CONSENT_ROUTE, async (route) => {
    attempts += 1;
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Bad Gateway' }),
    });
  });

  await page.goto(consentUrl({ pid: 'someone-not-listed' }), {
    waitUntil: 'domcontentloaded',
  });

  const checkbox = page.locator('#consentCheckbox');
  await expect(checkbox).toBeEnabled();
  await checkbox.check();
  await page.locator('#consentAcceptBtn').click();

  const status = page.locator('#consentStatus');
  await expect(status).toContainText('Please try again', {
    timeout: 20_000,
  });
  expect(attempts).toBe(3);
  // Temporary: the participant may retry once the backend is back.
  await expect(page.locator('#consentAcceptBtn')).toBeEnabled();
  await expect(checkbox).toBeEnabled();
});
