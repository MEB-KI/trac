const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 1600, height: 900 } });

async function waitForActivitiesLoaded(page) {
  await expect
    .poll(
      async () => page.locator('#activitiesContainer .activity-button').count(),
      {
        timeout: 30000,
        message: 'Waiting for activities to load',
      }
    )
    .toBeGreaterThan(0);
}

async function selectFirstVisibleActivity(page) {
  await waitForActivitiesLoaded(page);

  const placeable = page.locator(
    '#activitiesContainer .activity-button:visible:not(.has-child-items):not(.custom-input)'
  );

  if (await placeable.count()) {
    await placeable.first().click();
  } else {
    await page
      .locator('#activitiesContainer .activity-button:visible')
      .first()
      .click();
  }

  await expect
    .poll(async () => page.evaluate(() => !!window.selectedActivity), {
      timeout: 3000,
      message: 'Waiting for selected activity state after button click',
    })
    .toBeTruthy();
}

async function clickActiveTimelineAtPercent(page, targetPercent) {
  const timeline = page
    .locator('.timeline-container[data-active="true"] .timeline')
    .first();
  await expect(timeline).toBeVisible();

  const box = await timeline.boundingBox();
  expect(box).not.toBeNull();

  const x = box.x + (box.width * targetPercent) / 100;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
}

async function addActivityAtPercentAndGetId(page, percent) {
  const before = await page.evaluate(() => {
    const key =
      window.timelineManager.keys[window.timelineManager.currentIndex];
    const ids = (window.timelineManager.activities[key] || []).map((a) =>
      String(a.id)
    );
    return { key, ids };
  });

  await selectFirstVisibleActivity(page);
  await clickActiveTimelineAtPercent(page, percent);

  await expect
    .poll(
      async () => {
        return page.evaluate((beforeIds) => {
          const key =
            window.timelineManager.keys[window.timelineManager.currentIndex];
          const ids = (window.timelineManager.activities[key] || []).map((a) =>
            String(a.id)
          );
          return ids.find((id) => !beforeIds.includes(id)) || null;
        }, before.ids);
      },
      {
        timeout: 5000,
        message:
          'Waiting for newly placed activity to appear in timeline state',
      }
    )
    .not.toBeNull();

  const after = await page.evaluate((beforeIds) => {
    const key =
      window.timelineManager.keys[window.timelineManager.currentIndex];
    const ids = (window.timelineManager.activities[key] || []).map((a) =>
      String(a.id)
    );
    return ids.find((id) => !beforeIds.includes(id)) || null;
  }, before.ids);

  return after;
}

test('desktop context menu deletes activity and shows info modal in English', async ({
  page,
}) => {
  const pid = `ctxmenu_e2e_${Date.now()}`;

  await page.goto(
    `index.html?study_name=default&lang=en&day_label_index=0&pid=${pid}`,
    {
      waitUntil: 'domcontentloaded',
    }
  );

  const continueBtn = page.locator('#continueBtn');
  const hasInstructionsStart = await continueBtn
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (hasInstructionsStart) {
    await continueBtn.click();
    await page.waitForLoadState('domcontentloaded');
  }

  await expect(
    page.locator('.timeline-container[data-active="true"] .timeline').first()
  ).toBeVisible();
  await waitForActivitiesLoaded(page);

  await expect
    .poll(
      async () =>
        page.evaluate(() => window.i18n?.getCurrentLanguage?.() || null),
      {
        timeout: 10000,
        message: 'Waiting for i18n language to initialize to English',
      }
    )
    .toBe('en');

  const firstActivityId = await addActivityAtPercentAndGetId(page, 25);
  expect(firstActivityId).toBeTruthy();

  const firstBlock = page
    .locator(
      `.timeline-container[data-active="true"] .activity-block[data-id="${firstActivityId}"]`
    )
    .first();
  await expect(firstBlock).toBeVisible();

  await firstBlock.click({ button: 'right' });

  const menu = page.locator('#activityContextMenu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-action="show-info"]')).toHaveText(
    'Show info'
  );
  await expect(menu.locator('[data-action="delete"]')).toHaveText('Delete');

  await menu.locator('[data-action="delete"]').click();

  await expect(firstBlock).toHaveCount(0);
  await expect
    .poll(
      async () => {
        return page.evaluate((id) => {
          const key =
            window.timelineManager.keys[window.timelineManager.currentIndex];
          const activities = window.timelineManager.activities[key] || [];
          return activities.some((a) => String(a.id) === String(id));
        }, firstActivityId);
      },
      {
        timeout: 5000,
        message:
          'Waiting for deleted activity to be removed from timeline state',
      }
    )
    .toBeFalsy();

  const secondActivityId = await addActivityAtPercentAndGetId(page, 40);
  expect(secondActivityId).toBeTruthy();

  const secondBlock = page
    .locator(
      `.timeline-container[data-active="true"] .activity-block[data-id="${secondActivityId}"]`
    )
    .first();
  await expect(secondBlock).toBeVisible();

  await secondBlock.click({ button: 'right' });
  await expect(menu).toBeVisible();
  await menu.locator('[data-action="show-info"]').click();

  const infoModal = page.locator('#activityInfoModal');
  await expect(infoModal).toBeVisible();
  await expect(infoModal.locator('.modal-header h3')).toHaveText(
    'Activity details'
  );
  await expect(infoModal.locator('#activityInfoTableBody tr')).toHaveCount(7);
  await expect(infoModal.locator('#activityInfoTableBody')).toContainText(
    'Label'
  );
  await expect(infoModal.locator('#activityInfoTableBody')).toContainText(
    'Category'
  );

  await infoModal.locator('.modal-close').click();
  await expect(infoModal).not.toBeVisible();
});
