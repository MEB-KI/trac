const { test, expect } = require('@playwright/test');
const { enterStudyIfNeeded } = require('./e2e_helpers.js');

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

async function enterStudyWithRetry(page, maxAttempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await enterStudyIfNeeded(page);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        throw error;
      }

      const message = String(error?.message || '');
      const isTransientNavigationIssue =
        message.includes('WebKit encountered an internal error') ||
        message.includes('net::ERR_ABORTED') ||
        message.includes('Navigation failed because page was closed');

      if (!isTransientNavigationIssue) {
        throw error;
      }

      await page.waitForTimeout(500);
    }
  }

  throw lastError;
}

async function selectTopLevelByCode(page, code) {
  await waitForActivitiesLoaded(page);
  const btn = page.locator(`#activitiesContainer .activity-button[data-code="${code}"]`).first();
  await expect(btn).toBeVisible();
  await btn.click();
}

async function selectChildByCodes(page, parentCode, childCode) {
  await selectTopLevelByCode(page, parentCode);
  const childModal = page.locator('#childItemsModal');
  await expect(childModal).toBeVisible();

  const childBtn = page
    .locator(`#childItemsContainer .child-item-button[data-code="${childCode}"]`)
    .first();
  await expect(childBtn).toBeVisible();
  await childBtn.click();
}

async function confirmDetailsModal({
  page,
  expectedInputVisible,
  expectedFrequencyVisible,
  customText,
  frequencyKey,
}) {
  const modal = page.locator('#customActivityModal');
  await expect(modal).toBeVisible();

  const inputContainer = page.locator('#customActivityInputContainer');
  const frequencyContainer = page.locator('#customActivityFrequencyContainer');

  if (expectedInputVisible) {
    await expect(inputContainer).toBeVisible();
  } else {
    await expect(inputContainer).toBeHidden();
  }

  if (expectedFrequencyVisible) {
    await expect(frequencyContainer).toBeVisible();
  } else {
    await expect(frequencyContainer).toBeHidden();
  }

  if (customText != null) {
    await page.locator('#customActivityInput').fill(customText);
  }

  if (frequencyKey != null) {
    await page.locator('#customActivityFrequencySelect').selectOption(frequencyKey);
  }

  await page.locator('#confirmCustomActivity').click();
  await expect(modal).toBeHidden();
}

async function clickActiveTimelineAtPercent(page, targetPercent) {
  const timeline = page
    .locator('.timeline-container[data-active="true"] .timeline')
    .first();
  await expect(timeline).toBeVisible();

  await timeline.evaluate((el, percent) => {
    const rect = el.getBoundingClientRect();
    const x =
      rect.left +
      Math.max(1, Math.min(rect.width - 1, (rect.width * percent) / 100));
    const y = rect.top + Math.max(1, Math.min(rect.height - 1, rect.height / 2));

    const types = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    for (const type of types) {
      el.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          view: window,
        })
      );
    }
  }, targetPercent);
}

async function placeSelectedAtPercentAndGetId(page, percent) {
  const selectedSnapshot = await page.evaluate(() => {
    if (!window.selectedActivity || !window.selectedActivity.name) {
      return null;
    }
    return JSON.parse(JSON.stringify(window.selectedActivity));
  });

  if (!selectedSnapshot) {
    throw new Error('Cannot place activity because window.selectedActivity is not set');
  }

  const beforeIds = await page.evaluate(() => {
    const key = window.timelineManager.keys[window.timelineManager.currentIndex];
    return (window.timelineManager.activities[key] || []).map((a) => String(a.id));
  });

  const offsets = [0, 7, -7, 14, -14, 21, -21, 28, -28];
  const nearbyAttempts = offsets
    .map((offset) => Math.max(2, Math.min(98, percent + offset)))
    .filter((value, index, arr) => arr.indexOf(value) === index);
  const fullSweepAttempts = Array.from({ length: 19 }, (_, i) => 2 + i * 5);
  const attempts = [...nearbyAttempts, ...fullSweepAttempts].filter(
    (value, index, arr) => arr.indexOf(value) === index
  );

  for (const targetPercent of attempts) {
    await page.evaluate((snapshot) => {
      if (!window.selectedActivity) {
        window.selectedActivity = JSON.parse(JSON.stringify(snapshot));
        return;
      }

      if (Number(window.selectedActivity.code) !== Number(snapshot.code)) {
        window.selectedActivity = JSON.parse(JSON.stringify(snapshot));
      }
    }, selectedSnapshot);

    await clickActiveTimelineAtPercent(page, targetPercent);

    const newIdHandle = await page.waitForFunction(
      (knownIds) => {
        const key = window.timelineManager.keys[window.timelineManager.currentIndex];
        const ids = (window.timelineManager.activities[key] || []).map((a) =>
          String(a.id)
        );
        return ids.find((id) => !knownIds.includes(id)) || null;
      },
      beforeIds,
      { timeout: 3500 }
    ).catch(() => null);

    if (newIdHandle) {
      const newId = await newIdHandle.jsonValue();
      if (newId) {
        return String(newId);
      }
    }

    await page.waitForTimeout(120);
  }

  throw new Error(`Could not place activity around ${percent}% after retries`);
}

async function expectSelectedActivityCode(page, code) {
  const handle = await page.waitForFunction(
    (targetCode) => {
      const selected = window.selectedActivity;
      if (!selected) {
        return null;
      }
      return Number(selected.code) === Number(targetCode)
        ? { code: Number(selected.code), frequencyKey: selected.frequencyKey || null }
        : null;
    },
    code,
    { timeout: 10000 }
  );
  return handle.jsonValue();
}

async function expectActivityByIdValues(
  page,
  { id, expectedCode, expectedFrequencyKey, namePattern }
) {
  const activityHandle = await page.waitForFunction(
    (activityId) => {
      const keys = window.timelineManager.keys || [];
      for (const key of keys) {
        const list = window.timelineManager.activities[key] || [];
        const found = list.find((a) => String(a.id) === String(activityId));
        if (found) {
          return {
            code: Number(found.code),
            activity: String(found.activity || ''),
            frequencyKey: found.frequencyKey || null,
          };
        }
      }
      return null;
    },
    id,
    { timeout: 10000 }
  );

  const activity = await activityHandle.jsonValue();
  if (!activity) {
    throw new Error(`Could not find activity id ${id} in timeline data`);
  }

  expect(activity.code).toBe(Number(expectedCode));
  expect(activity.frequencyKey).toBe(expectedFrequencyKey ?? null);

  if (namePattern) {
    expect(activity.activity).toMatch(namePattern);
  }
}

async function deleteActivityById(page, id) {
  const block = page
    .locator(`.timeline-container[data-active="true"] .activity-block[data-id="${id}"]`)
    .first();
  await expect(block).toBeVisible();

  await block.click({ button: 'right' });
  const menu = page.locator('#activityContextMenu');
  if (!(await menu.isVisible())) {
    await block.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      element.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          button: 2,
        })
      );
    });
  }

  if (await menu.isVisible()) {
    const deleteButton = menu.locator('[data-action="delete"]:visible').first();
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();
  } else {
    // Fallback path for flaky right-click handling in CI/browser engines:
    // the app supports deleting the currently hovered activity via keyboard shortcut.
    await block.hover();
    await page.keyboard.press('d');
  }

  await expect(block).toHaveCount(0);
}

test('frequency flows cover all combinations and non-frequency edit flows remain stable', async ({
  page,
}) => {
  const pid = `freq-e2e-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  await page.goto(`index.html?study_name=default&lang=de&pid=${pid}`, {
    waitUntil: 'domcontentloaded',
  });

  await enterStudyWithRetry(page);
  await waitForActivitiesLoaded(page);

  // 1) Top-level, non-custom with frequency (1163)
  await selectTopLevelByCode(page, 1163);
  await confirmDetailsModal({
    page,
    expectedInputVisible: false,
    expectedFrequencyVisible: true,
    frequencyKey: 'bi-weekly',
  });
  await expectSelectedActivityCode(page, 1163);
  const freq1163Id = await placeSelectedAtPercentAndGetId(page, 12);
  await expectActivityByIdValues(page, {
    id: freq1163Id,
    expectedCode: 1163,
    expectedFrequencyKey: 'bi-weekly',
  });

  // 2) Top-level, custom with frequency (1164)
  const hobbyCustomText = 'Museumsbesuch am Abend';
  await selectTopLevelByCode(page, 1164);
  await confirmDetailsModal({
    page,
    expectedInputVisible: true,
    expectedFrequencyVisible: true,
    customText: hobbyCustomText,
    frequencyKey: 'monthly',
  });
  const freq1164Id = await placeSelectedAtPercentAndGetId(page, 24);
  await expectActivityByIdValues(page, {
    id: freq1164Id,
    expectedCode: 1164,
    expectedFrequencyKey: 'monthly',
    namePattern: /Museumsbesuch am Abend/i,
  });

  // 3) Child-item, non-custom with frequency (1167)
  await selectChildByCodes(page, 1166, 1167);
  await expect(page.locator('#childItemsModal')).toBeHidden();
  await confirmDetailsModal({
    page,
    expectedInputVisible: false,
    expectedFrequencyVisible: true,
    frequencyKey: 'monthly',
  });
  const freq1167Id = await placeSelectedAtPercentAndGetId(page, 36);
  await expectActivityByIdValues(page, {
    id: freq1167Id,
    expectedCode: 1167,
    expectedFrequencyKey: 'monthly',
  });

  // 4) Child-item, custom with frequency (1171)
  const outdoorCustomText = 'Basketball im Park';
  await selectChildByCodes(page, 1166, 1171);
  await confirmDetailsModal({
    page,
    expectedInputVisible: true,
    expectedFrequencyVisible: true,
    customText: outdoorCustomText,
    frequencyKey: 'bi-weekly',
  });
  const freq1171Id = await placeSelectedAtPercentAndGetId(page, 48);
  await expectActivityByIdValues(page, {
    id: freq1171Id,
    expectedCode: 1171,
    expectedFrequencyKey: 'bi-weekly',
    namePattern: /Basketball im Park/i,
  });

  // Regression A: standard top-level (1162) remains unaffected and editable
  await selectTopLevelByCode(page, 1162);
  await expectSelectedActivityCode(page, 1162);
  const errandsId = await placeSelectedAtPercentAndGetId(page, 60);
  await expectActivityByIdValues(page, {
    id: errandsId,
    expectedCode: 1162,
    expectedFrequencyKey: null,
  });
  await deleteActivityById(page, errandsId);
  await selectTopLevelByCode(page, 1162);
  await expectSelectedActivityCode(page, 1162);
  await placeSelectedAtPercentAndGetId(page, 64);

  // Regression B: custom top-level without frequency (1147) remains unaffected and editable
  const customA = 'Werkstatt zuhause';
  await selectTopLevelByCode(page, 1147);
  await confirmDetailsModal({
    page,
    expectedInputVisible: true,
    expectedFrequencyVisible: false,
    customText: customA,
  });
  const customAId = await placeSelectedAtPercentAndGetId(page, 74);
  await expectActivityByIdValues(page, {
    id: customAId,
    expectedCode: 1147,
    expectedFrequencyKey: null,
    namePattern: /Werkstatt zuhause/i,
  });

  await deleteActivityById(page, customAId);
  const customB = 'Basteln im Keller';
  await selectTopLevelByCode(page, 1147);
  await confirmDetailsModal({
    page,
    expectedInputVisible: true,
    expectedFrequencyVisible: false,
    customText: customB,
  });
  const customBId = await placeSelectedAtPercentAndGetId(page, 80);
  await expectActivityByIdValues(page, {
    id: customBId,
    expectedCode: 1147,
    expectedFrequencyKey: null,
    namePattern: /Basteln im Keller/i,
  });
});
