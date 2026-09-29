const { test, expect } = require('@playwright/test');
const { MOBILE_VIEWPORT } = require('./participant_pages.js');
const { enterStudyIfNeeded, findTimelinePoint } = require('./e2e_helpers.js');

// Keyboard-only behaviour, which no other spec exercises: every existing test
// clicks. `js/ui.js` traps Tab inside the open dialog and closes it on Escape,
// restoring focus to whatever opened it - if that breaks (e.g. the
// MutationObserver stops seeing the dialog, or focus is not restored), a mouse
// user notices nothing while a keyboard or screen-reader user is stranded.
//
// The picker is a dialog on phones (the floating add button opens it), so these
// tests run in the mobile layout.
test.use({ viewport: MOBILE_VIEWPORT, hasTouch: true });

const FOCUS_INSIDE_DIALOG = (dialogId) => `
  (() => {
    const dialog = document.getElementById('${dialogId}');
    if (!dialog) return false;
    return dialog.contains(document.activeElement);
  })()
`;

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} pid
 */
async function openDiary(page, pid) {
  await page.goto(`index.html?pid=${pid}&study_name=default&lang=en`, {
    waitUntil: 'load',
  });
  await enterStudyIfNeeded(page);
}

test('the activity picker keeps focus inside the dialog and Escape gives it back', async ({
  page,
}) => {
  await openDiary(page, 'kbd_picker');

  const addButton = page.locator('.floating-add-button');
  await addButton.click();
  await expect(page.locator('#activitiesModal')).toBeVisible();
  await expect(
    page.locator('#modalActivitiesContainer .activity-button').first()
  ).toBeVisible({ timeout: 30000 });

  // Focus must move into the dialog, not stay at the top of the document.
  await expect
    .poll(() => page.evaluate(FOCUS_INSIDE_DIALOG('activitiesModal')), {
      timeout: 5000,
      message: 'Focus should move into the opened activity picker',
    })
    .toBe(true);

  // Tab (and Shift+Tab) may not escape the dialog.
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(FOCUS_INSIDE_DIALOG('activitiesModal')),
      `focus left the dialog after ${i + 1} Tab press(es)`
    ).toBe(true);
  }
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(
      await page.evaluate(FOCUS_INSIDE_DIALOG('activitiesModal')),
      `focus left the dialog after ${i + 1} Shift+Tab press(es)`
    ).toBe(true);
  }

  // Escape closes it and returns focus to the button that opened it.
  await page.keyboard.press('Escape');
  await expect(page.locator('#activitiesModal')).toBeHidden();
  await expect(addButton).toBeFocused();
});

test('the activity info dialog closes on Escape and does not keep focus', async ({
  page,
}) => {
  // Placement is easiest through the desktop activity panel; the focus trap it
  // tests lives in js/ui.js and behaves the same in both layouts.
  await page.setViewportSize({ width: 1600, height: 900 });
  await openDiary(page, 'kbd_info');

  // Place one activity.
  const activityButton = page
    .locator(
      '#activitiesContainer .activity-button:visible:not(.has-child-items):not(.custom-input)'
    )
    .first();
  await activityButton.waitFor({ state: 'visible', timeout: 30000 });
  await activityButton.click();
  const timeline = page
    .locator('.timeline-container[data-active="true"] .timeline')
    .first();
  await timeline.waitFor({ state: 'visible', timeout: 10000 });
  await timeline.scrollIntoViewIfNeeded();
  const clickPoint = await findTimelinePoint(page);
  await page.mouse.click(clickPoint.x, clickPoint.y);

  const block = page
    .locator('.timeline-container[data-active="true"] .activity-block')
    .first();
  await expect(block).toBeVisible({ timeout: 10000 });
  await block.click({ button: 'right' });
  await page.locator('#activityContextMenu [data-action="show-info"]').click();
  await expect(page.locator('#activityInfoModal')).toBeVisible();

  await expect
    .poll(() => page.evaluate(FOCUS_INSIDE_DIALOG('activityInfoModal')), {
      timeout: 5000,
      message: 'Focus should move into the opened activity info dialog',
    })
    .toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.locator('#activityInfoModal')).toBeHidden();

  // Focus must not stay on the hidden dialog.
  expect(
    await page.evaluate(FOCUS_INSIDE_DIALOG('activityInfoModal')),
    'focus must not remain inside the closed dialog'
  ).toBe(false);
});

test('timeline containers are named, focusable groups', async ({ page }) => {
  await openDiary(page, 'kbd_timelines');

  const timelines = page.locator('.timeline');
  const count = await timelines.count();
  expect(count, 'the diary should render at least one timeline').toBeGreaterThan(
    0
  );

  for (let i = 0; i < count; i += 1) {
    const timeline = timelines.nth(i);
    // aria-label on a bare div is dropped by assistive tech (axe:
    // aria-prohibited-attr), so the role has to be there.
    await expect(timeline).toHaveAttribute('role', 'group');
    const label = await timeline.getAttribute('aria-label');
    expect(label, `timeline ${i} needs an accessible name`).toBeTruthy();
    await expect(timeline).toHaveAttribute('tabindex', '0');
  }

  // Only the active timeline is on screen (the inactive ones sit in a hidden
  // wrapper), so that is the one a keyboard user can reach.
  const activeTimeline = page.locator(
    '.timeline-container[data-active="true"] .timeline'
  );
  await activeTimeline.first().focus();
  await expect(activeTimeline.first()).toBeFocused();
});