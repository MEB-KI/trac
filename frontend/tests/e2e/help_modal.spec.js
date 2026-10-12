// "How do I use this?" while working, without leaving the day.
//
// Opening the instructions page is *safe* now that the day autosaves (the day
// comes back from the URL, and pagehide flushes the engine), but it costs a
// page load, the scroll position, the selected activity and the participant's
// place in the day - and being thrown onto an error page mid-task is exactly
// what the pilot's "could not load / could not save" report was about. So the
// walk-through opens in a modal that loads the same page in `?embed=1` mode:
// one source of truth for the steps, the GIFs and the translations.
//
// These specs cover both halves of that contract: the embed page contains only
// the walk-through, and the modal closes back onto an untouched day.
const { test, expect } = require('@playwright/test');
const { MOBILE_VIEWPORT } = require('./participant_pages.js');
const {
  enterStudyIfNeeded,
  enterConsentAndInstructionsIfNeeded,
  placeActivityMobile,
} = require('./e2e_helpers.js');

test.use({ viewport: MOBILE_VIEWPORT, hasTouch: true });

const MODAL = '#helpModal';
const FRAME = '.help-modal-frame';

async function openDiary(page, pid) {
  await page.goto(`index.html?pid=${pid}&study_name=default&lang=en`, {
    waitUntil: 'load',
  });
  await enterStudyIfNeeded(page);
  await expect(page.locator('#contextBar')).toBeVisible({ timeout: 30000 });
}

async function activityCounts(page) {
  return page.evaluate(() => {
    const manager = window.timelineManager;
    return Object.fromEntries(
      manager.keys.map((key) => [key, (manager.activities[key] || []).length])
    );
  });
}

async function openHelpThroughMenu(page) {
  await page.locator('#moreMenuBtn').click();
  const menu = page.locator('#moreMenu');
  await expect(menu).toBeVisible();
  await page.locator('#moreMenu .more-menu-help').click();
  await expect(page.locator(MODAL)).toBeVisible();
}

test('the embed page is the walk-through and nothing else', async ({ page }) => {
  await page.goto(
    `index.html?pid=embed-${Date.now()}&study_name=default&lang=en`,
    { waitUntil: 'load' }
  );
  await enterConsentAndInstructionsIfNeeded(page);

  // Load the same content the modal loads, and check what it leaves out.
  await page.goto(
    `pages/instructions.html?pid=embed-only-${Date.now()}&study_name=default&lang=en&embed=1`,
    { waitUntil: 'load' }
  );
  await expect(page.locator('#howToSection')).toBeAttached();
  await page.waitForTimeout(600);

  expect(await page.locator('#howToSection').evaluate((el) => el.open)).toBe(true);
  await expect(page.locator('#instruction-step-copy-day')).toBeVisible();

  // None of the entry-page furniture travels into the modal.
  await expect(page.locator('#continueBtn')).toBeHidden();
  await expect(page.locator('#study-custom-message-title')).toBeHidden();
  await expect(page.locator('#study-custom-message-instructions')).toBeHidden();
  await expect(page.locator('.how-to-summary')).toBeHidden();
});

test('the diary opens the walk-through in a modal and stays where it was', async ({
  page,
}) => {
  await openDiary(page, `e2e-help-${Date.now()}`);

  // Something to come back to: leave a day behind, so "still there" is a real
  // assertion rather than an empty page comparing equal to itself.
  await placeActivityMobile(page, 40);
  const countsBefore = await activityCounts(page);
  expect(Object.values(countsBefore).some((count) => count > 0)).toBe(true);

  await openHelpThroughMenu(page);

  await expect(page.locator('#helpModalTitle')).toHaveText('How to use the diary');
  const frame = page.frameLocator(FRAME);
  await expect(frame.locator('#instruction-step-copy-day')).toBeVisible({
    timeout: 30000,
  });
  await expect(frame.locator('#study-custom-message-instructions')).toBeHidden();
  await expect(frame.locator('#continueBtn')).toBeHidden();

  // Closing returns to the diary: same page, same entries, no reload.
  await page.locator(`${MODAL} .modal-close`).click();
  await expect(page.locator(MODAL)).toBeHidden();
  expect(new URL(page.url()).pathname).toContain('index.html');
  expect(await activityCounts(page)).toEqual(countsBefore);
});

test('Escape closes the walk-through too', async ({ page }) => {
  await openDiary(page, `e2e-help-esc-${Date.now()}`);
  await openHelpThroughMenu(page);

  await page.keyboard.press('Escape');
  await expect(page.locator(MODAL)).toBeHidden();

  // The day is still interactive afterwards (the modal did not eat the page).
  await expect(page.locator('#contextBar')).toBeVisible();
  await expect(page.locator('.floating-add-button')).toBeVisible();
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1600, height: 900 }, hasTouch: false });

  test('the ⋮ menu offers it there as well', async ({ page }) => {
    await page.goto(`index.html?pid=e2e-help-desk-${Date.now()}&study_name=default&lang=en`, {
      waitUntil: 'load',
    });
    await enterStudyIfNeeded(page);
    await expect(page.locator('#moreMenuBtn')).toBeVisible({ timeout: 30000 });

    await openHelpThroughMenu(page);
    const frame = page.frameLocator(FRAME);
    await expect(frame.locator('#instruction-step-copy-day')).toBeVisible({
      timeout: 30000,
    });

    await page.locator(`${MODAL} .modal-close`).click();
    await expect(page.locator(MODAL)).toBeHidden();
  });
});
