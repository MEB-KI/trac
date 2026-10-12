// Desktop resize affordance.
//
// Participant feedback (2026-10) reported that nothing on an activity block
// showed that its duration can be adjusted by dragging the edges - the gesture
// worked, but the 10 px zones are invisible and the hover tooltip had taken over
// ::before. These specs guard the visible grips and, just as importantly, that
// they did not disturb the pointer behaviour they merely decorate: the block
// must stay the pointer target (pointer-events: none) and an edge drag must
// still resize the activity.
const { test, expect } = require('@playwright/test');
const { enterStudyIfNeeded, placeActivity } = require('./e2e_helpers.js');

const BLOCK = '.timeline-container[data-active="true"] .activity-block';
const GRIP = '.activity-block-grip';

test.use({ viewport: { width: 1600, height: 900 } });

/** Enter the diary, place one activity, and return its block locator. */
async function placeBlock(page) {
  await page.goto('index.html?study_name=default&lang=en', {
    waitUntil: 'domcontentloaded',
  });
  await enterStudyIfNeeded(page);
  await placeActivity(page, { activityName: 'Sleeping', positionPercent: 30 });

  const block = page.locator(BLOCK).first();
  await expect(block).toBeVisible();
  return block;
}

/** Read the rendered state of both grips. */
function gripStyles(block) {
  return block.evaluate((el) =>
    [...el.querySelectorAll('.activity-block-grip')].map((grip) => {
      const style = getComputedStyle(grip);
      return {
        side: grip.classList.contains('activity-block-grip-right')
          ? 'right'
          : 'left',
        display: style.display,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
      };
    })
  );
}

test('the resize grips are hidden until the block is targeted', async ({
  page,
}) => {
  const block = await placeBlock(page);

  // Park the pointer away from the timeline first: the click that placed the
  // activity leaves it hovering the new block.
  await page.mouse.move(5, 5);
  await expect
    .poll(async () => (await gripStyles(block)).map((g) => g.opacity))
    .toEqual(['0', '0']);

  // Pointer stays on the block itself, never on a grip: this is what keeps
  // interact.js' drag/resize behaviour unchanged.
  const resting = await gripStyles(block);
  expect(resting).toHaveLength(2);
  expect(resting.map((grip) => grip.side)).toEqual(['left', 'right']);
  for (const grip of resting) {
    expect(grip.display).toBe('block');
    expect(grip.pointerEvents).toBe('none');
    expect(grip.opacity).toBe('0');
  }

  await block.hover();
  for (const grip of await gripStyles(block)) {
    expect(grip.opacity).toBe('1');
  }

  // Leaving the block hides them again.
  await page.mouse.move(5, 5);
  await expect
    .poll(async () => (await gripStyles(block)).map((g) => g.opacity))
    .toEqual(['0', '0']);
});

test('an edge drag still resizes the block with the grips in place', async ({
  page,
}) => {
  const block = await placeBlock(page);

  const before = Number(await block.getAttribute('data-length'));
  const box = await block.boundingBox();
  const timeline = await page
    .locator('.timeline-container[data-active="true"] .timeline')
    .first()
    .boundingBox();
  // 20 minutes of timeline width, snapped by the 10-minute grid modifier.
  const twentyMinutesPx = (timeline.width * 20) / (24 * 60);

  const y = box.y + box.height / 2;
  const rightEdgeX = box.x + box.width - 3; // inside the 10 px edge zone
  await page.mouse.move(rightEdgeX, y);
  await page.mouse.down();
  await page.mouse.move(rightEdgeX + twentyMinutesPx, y, { steps: 6 });

  // The grips are part of the resizing state, and the block is still the
  // element the interaction affects.
  await expect(block).toHaveClass(/resizing/);
  for (const grip of await gripStyles(block)) {
    expect(grip.opacity).toBe('1');
  }

  await page.mouse.up();

  await expect(block).not.toHaveClass(/resizing/);
  await expect
    .poll(async () => Number(await block.getAttribute('data-length')))
    .toBe(before + 20);
});

test('keyboard focus shows the grips too', async ({ page }) => {
  const block = await placeBlock(page);

  // Tab until a block receives focus (blocks are tabbable; the diary has many
  // focusable controls before them, so this is bounded and explicit).
  let focusedBlock = false;
  for (let i = 0; i < 60 && !focusedBlock; i += 1) {
    await page.keyboard.press('Tab');
    focusedBlock = await page.evaluate(
      () =>
        !!document.activeElement &&
        document.activeElement.classList.contains('activity-block')
    );
  }
  expect(
    focusedBlock,
    'no activity block received keyboard focus within 60 Tab presses'
  ).toBe(true);

  for (const grip of await gripStyles(page.locator(BLOCK).first())) {
    expect(grip.opacity).toBe('1');
  }
});
