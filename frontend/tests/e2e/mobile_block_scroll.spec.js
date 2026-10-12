// The activity block's touch surface: scrolling vs. resizing.
//
// On a phone the blocks cover ~75 % of the timeline width, and the base rule
// `touch-action: none` on `.activity-block` made every swipe that started on a
// block do nothing at all - neither scroll nor edit. One participant reported it
// as "the scrolling doesn't work on my phone"; measured with real touch input, a
// swipe on a block moved the timeline 0 px while the same swipe 30 px to the left
// (the free gutter) scrolled it.
//
// The fix lets the block's body pan vertically and reserves the top/bottom bands
// for the resize gesture (`.activity-block-edge-zone`, `touch-action: none`) -
// without that reservation the browser would start scrolling mid-drag and cancel
// the resize with `pointercancel`. These specs pin the contract down:
//   1. the computed touch-action of the block and its end zones (every engine),
//   2. with real touch input: a body swipe scrolls, an end drag resizes and does
//      not scroll (Chromium only - CDP touch injection),
//   3. the long press still opens the context menu.
//
// The rest of the mobile suite drives the phone layout with the *mouse*, which
// browsers never subject to `touch-action`, so a regression here would be
// invisible to it. Hence the computed-style assertions in (1) for every engine
// and the real-touch test in (2).
const { test, expect } = require('@playwright/test');
const { MOBILE_VIEWPORT } = require('./participant_pages.js');
const { enterStudyIfNeeded, placeActivityMobile } = require('./e2e_helpers.js');

test.use({ viewport: MOBILE_VIEWPORT, hasTouch: true });

const BLOCK = '.timeline-container[data-active="true"] .activity-block';
const CONTEXT_MENU = '#activityContextMenu';

async function openDiary(page, pid) {
  await page.goto(`index.html?pid=${pid}&study_name=default&lang=en`, {
    waitUntil: 'load',
  });
  await enterStudyIfNeeded(page);
  await expect
    .poll(async () => page.evaluate(() => !!window.timelineManager?.activeTimeline), {
      timeout: 30000,
      message: 'waiting for the timeline to initialize',
    })
    .toBe(true);

  // The day-one banner inserts itself above the timeline (and is moved into the
  // context bar later), which shifts every coordinate measured before that has
  // settled. Close it first - a real participant does the same.
  const bannerClose = page.locator('#instructionBanner .banner-close');
  if (await bannerClose.isVisible().catch(() => false)) {
    await bannerClose.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

/**
 * A viewport point that really hits the block (`where`: 'top' | 'centre').
 *
 * The point is verified with `elementFromPoint` and retried with a fresh scroll,
 * because the timeline re-lays out after the activity picker closes and the
 * sticky header covers the top ~235 px of the screen - "inside the viewport" is
 * not the same as "receives the touch". Throwing here is deliberate: a silent
 * miss is how the first version of this spec measured nothing at all.
 *
 * @returns {Promise<{x:number,y:number,hit:string}>} `hit` is the class name of
 *   the element the point lands on, so callers can assert *what* they touch.
 */
async function pointOnBlock(page, block, where) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await block.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(250);

    const probe = await block.evaluate((el, where) => {
      const rect = el.getBoundingClientRect();
      const y =
        where === 'top'
          ? rect.top + 4
          : where === 'bottom'
            ? rect.bottom - 4
            : rect.top + rect.height / 2;
      const x = rect.left + rect.width / 2;
      const hit = document.elementFromPoint(Math.round(x), Math.round(y));
      const headerBottom =
        document.querySelector('.header-section')?.getBoundingClientRect().bottom ??
        0;
      return {
        x: Math.round(x),
        y: Math.round(y),
        hit: hit ? String(hit.className || hit.tagName) : '',
        insideBlock: !!(hit && el.contains(hit)),
        blockTop: Math.round(rect.top),
        blockBottom: Math.round(rect.bottom),
        headerBottom: Math.round(headerBottom),
      };
    }, where);

    const clearOfHeader = probe.blockTop > probe.headerBottom;
    // A drag needs room to move: keep the end that is grabbed away from the
    // bottom of the window as well.
    const roomToDrag =
      where === 'bottom' ? probe.blockBottom < 760 : probe.blockTop > 0;

    if (probe.insideBlock && clearOfHeader && roomToDrag) {
      return { x: probe.x, y: probe.y, hit: probe.hit };
    }

    // Push the block clear of the header and retry.
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const wrap = document.querySelector('.timelines-wrapper');
      const headerBottom =
        document.querySelector('.header-section')?.getBoundingClientRect().bottom ??
        0;
      wrap.scrollTop += el.getBoundingClientRect().top - (headerBottom + 80);
    }, BLOCK);
  }

  throw new Error(`no usable touch point found on the block (${where})`);
}

function scrollTop(page) {
  return page.evaluate(() =>
    Math.round(document.querySelector('.timelines-wrapper').scrollTop)
  );
}

function blockTiming(page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return {
      length: Number(el.dataset.length),
      startMinutes: Number(el.dataset.startMinutes),
      endMinutes: Number(el.dataset.endMinutes),
    };
  }, BLOCK);
}

test('the block body pans the timeline and its ends stay reserved for resizing', async ({
  page,
}) => {
  await openDiary(page, `e2e-scroll-contract-${Date.now()}`);
  const block = await placeActivityMobile(page);

  const contract = await block.evaluate((el) => {
    const top = el.querySelector('.activity-block-edge-zone-top');
    const bottom = el.querySelector('.activity-block-edge-zone-bottom');
    const topRect = top ? top.getBoundingClientRect() : null;
    return {
      blockTouchAction: getComputedStyle(el).touchAction,
      hasBothZones: !!top && !!bottom,
      zoneTouchAction: top ? getComputedStyle(top).touchAction : null,
      zoneHeight: topRect ? Math.round(topRect.height) : 0,
      blockHeight: Math.round(el.getBoundingClientRect().height),
    };
  });

  // The permission that makes a swipe on a block scroll the timeline.
  expect(contract.blockTouchAction).toBe('pan-y pinch-zoom');
  // The permission that keeps the resize gesture from being stolen by a scroll.
  expect(contract.hasBothZones).toBe(true);
  expect(contract.zoneTouchAction).toBe('none');

  // The middle of the block has to be free for scrolling: the point is verified
  // against the live layout, so a stale coordinate cannot make this vacuous.
  const centre = await pointOnBlock(page, block, 'centre');
  if (contract.blockHeight > 2 * contract.zoneHeight + 2) {
    expect(
      centre.hit,
      `the middle of a ${contract.blockHeight}px block must be scrollable, but the touch lands on "${centre.hit}"`
    ).not.toContain('activity-block-edge-zone');
  }

  // ... and the end band has to be reachable by a finger, otherwise the resize
  // it reserves could not be started at all. `pointOnBlock` scrolls the block
  // clear of the sticky header and proves the point lands inside the block -
  // scanning the band's pixels is not usable here because the fixture block can
  // be hours long, so its top and its middle never share the screen.
  const end = await pointOnBlock(page, block, 'top');
  expect(
    end.hit,
    `the point near the block's top must land inside it, not on "${end.hit}"`
  ).toBeTruthy();
});

test('a swipe on a block scrolls the timeline and an end drag resizes it', async ({
  page,
  browserName,
}) => {
  // Real touch input, so the browser's touch-action arbitration is exercised:
  // synthetic dispatchEvent() touches do not scroll, and a mouse never sees
  // touch-action at all.
  test.skip(browserName !== 'chromium', 'CDP touch injection is Chromium-only');

  await openDiary(page, `e2e-scroll-touch-${Date.now()}`);
  const block = await placeActivityMobile(page);

  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  const swipe = async (x, y, dy, steps = 14) => {
    await touch('touchStart', x, y);
    for (let i = 1; i <= steps; i += 1) {
      await touch('touchMove', x, y + (dy * i) / steps);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd', x, y);
  };

  // 1. A swipe starting on the block body must scroll the day.
  const centre = await pointOnBlock(page, block, 'centre');
  const beforeSwipe = await scrollTop(page);
  const timingBeforeSwipe = await blockTiming(page);

  await swipe(centre.x, centre.y, -220);
  await page.waitForTimeout(400);

  expect(
    (await scrollTop(page)) - beforeSwipe,
    'a swipe on a block has to scroll the timeline'
  ).toBeGreaterThan(60);
  expect(
    await blockTiming(page),
    'scrolling must not edit the activity'
  ).toEqual(timingBeforeSwipe);

  // 2. A drag starting in the end band must resize the activity and must not
  //    scroll the timeline. The end band is what the zoomed-in end-zone
  //    reservation is for; the direction of the resize (start or end of the
  //    block) is the app's business, what matters here is that the gesture is
  //    not swallowed by a scroll.
  const end = await pointOnBlock(page, block, 'bottom');
  const scrollBeforeDrag = await scrollTop(page);
  const timingBeforeDrag = await blockTiming(page);

  await touch('touchStart', end.x, end.y);
  for (let i = 1; i <= 10; i += 1) {
    await touch('touchMove', end.x, end.y + (50 * i) / 10);
    await page.waitForTimeout(16);
  }
  await expect(
    block,
    'the end band has to start a resize, not a scroll'
  ).toHaveClass(/resizing/);
  await touch('touchEnd', end.x, end.y);
  await page.waitForTimeout(400);

  expect(
    Math.abs((await scrollTop(page)) - scrollBeforeDrag),
    'dragging the end band must not scroll the timeline'
  ).toBeLessThan(8);
  const timingAfterDrag = await blockTiming(page);
  expect(
    timingAfterDrag,
    'the end band is still the resize handle, so it has to change the timing'
  ).not.toEqual(timingBeforeDrag);
});

test('a still touch still opens the long-press menu', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP touch injection is Chromium-only');

  await openDiary(page, `e2e-scroll-longpress-${Date.now()}`);
  const block = await placeActivityMobile(page);
  const centre = await pointOnBlock(page, block, 'centre');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: centre.x, y: centre.y }],
  });
  // Poll while the finger is still down: the timer is 500 ms, the menu stays
  // open until the next press elsewhere.
  let menuVisible = true;
  try {
    await expect(page.locator(CONTEXT_MENU)).toBeVisible({ timeout: 2500 });
  } catch (error) {
    menuVisible = false;
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  expect(
    menuVisible,
    'a motionless touch must still open the context menu'
  ).toBe(true);
});
