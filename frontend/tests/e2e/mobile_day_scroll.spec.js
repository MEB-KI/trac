// Scrolling the day on a phone: both directions, and all the way to the end.
//
// Two things were wrong on the day itself, neither of them visible to a mouse.
//
// 1. A document-level `touchmove` handler called `preventDefault()` whenever
//    `window.pageYOffset === 0` and the finger moved down. On the diary the
//    window never scrolls - the day scrolls inside `.timelines-wrapper` - so
//    that condition was permanently true and every downward drag was cancelled.
//    The day could be swiped forward to its end, but the finger's journey back
//    did nothing at all: "I cannot scroll up again, I'm stuck". A mouse never
//    triggers it, so the rest of the mobile suite (which drives the phone layout
//    with the mouse, or synthetic events that browsers never subject to
//    touch-action) passed throughout.
//
// 2. The day's content ended exactly at the bottom edge of the scroller, so the
//    last hour line - the end of the day - could not be brought into view: at
//    maximum scroll it sat on the boundary with nothing reserved beneath it.
//    The padding fix adds room *outside* the timeline's own height, so the hour
//    spacing is untouched.
//
// These specs pin both down: the real-touch test in (1) needs CDP touch
// injection and therefore runs on Chromium only, the geometry in (2) is
// engine-independent.
const { test, expect } = require('@playwright/test');
const { MOBILE_VIEWPORT } = require('./participant_pages.js');
const { enterStudyIfNeeded } = require('./e2e_helpers.js');

test.use({ viewport: MOBILE_VIEWPORT, hasTouch: true });

const WRAPPER = '.timelines-wrapper';

async function openDiary(page, pid) {
  await page.goto(`index.html?pid=${pid}&study_name=default&lang=en`, {
    waitUntil: 'load',
  });
  await enterStudyIfNeeded(page);
  await expect
    .poll(
      async () => page.evaluate(() => !!window.timelineManager?.activeTimeline),
      { timeout: 30000, message: 'waiting for the timeline to initialize' }
    )
    .toBe(true);

  // The day-one banner inserts itself above the timeline and is moved again
  // while the page settles, which shifts every coordinate measured in the
  // meantime. Close it first - a real participant does the same.
  const bannerClose = page.locator('#instructionBanner .banner-close');
  if (await bannerClose.isVisible().catch(() => false)) {
    await bannerClose.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

function scrollTop(page) {
  return page.evaluate(
    (sel) => Math.round(document.querySelector(sel).scrollTop),
    WRAPPER
  );
}

function scrollRange(page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  }, WRAPPER);
}

/** Scroll the day to its end and wait for the animation to settle. */
async function scrollToEndOfDay(page) {
  await page.evaluate((sel) => {
    document.querySelector(sel).scrollTo({ top: 99999 });
  }, WRAPPER);
  await expect
    .poll(async () => {
      const { scrollTop: top, scrollHeight, clientHeight } = await scrollRange(page);
      return Math.abs(top - (scrollHeight - clientHeight)) <= 1;
    }, { timeout: 5000, message: 'waiting for the day to reach its end' })
    .toBe(true);
}

test('a swipe that reached the end of the day can be reversed', async ({
  page,
  browserName,
}) => {
  // Real touch input: only then does the browser arbitrate the gesture against
  // touch-action and the page's own listeners, which is where the drag was lost.
  test.skip(browserName !== 'chromium', 'CDP touch injection is Chromium-only');

  await openDiary(page, `e2e-day-scroll-back-${Date.now()}`);

  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  // `dy` is the finger's travel: negative is upward (the day moves forward),
  // positive is downward (the day moves back).
  const swipe = async (x, y, dy, steps = 14) => {
    await touch('touchStart', x, y);
    for (let i = 1; i <= steps; i += 1) {
      await touch('touchMove', x, y + (dy * i) / steps);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd', x, y);
    await page.waitForTimeout(300);
  };

  const range = await scrollRange(page);
  expect(
    range.scrollHeight - range.clientHeight,
    'the day has to be longer than the window for this to mean anything'
  ).toBeGreaterThan(500);
  expect(await scrollTop(page), 'the day starts at its beginning').toBe(0);

  // Walk to the end of the day the way a thumb does.
  const maxScroll = range.scrollHeight - range.clientHeight;
  let previous = 0;
  for (let i = 0; i < 8; i += 1) {
    await swipe(200, 700, -500);
    const now = await scrollTop(page);
    if (now === previous) break;
    previous = now;
  }
  expect(
    await scrollTop(page),
    'swiping upward has to walk the day to its end'
  ).toBeGreaterThan(maxScroll - 5);

  // ... and back again. This is the gesture the reported bug swallowed.
  const atEnd = await scrollTop(page);
  await swipe(200, 250, 500);
  const afterFirst = await scrollTop(page);
  expect(
    atEnd - afterFirst,
    'a downward swipe has to bring the day back, not be cancelled'
  ).toBeGreaterThan(300);

  // Still repeatable - the first reversal must not have been a fluke.
  await swipe(200, 250, 500);
  expect(
    await scrollTop(page),
    'every following downward swipe has to keep moving the day'
  ).toBeLessThan(afterFirst - 300);
});

test("the end of the day can be scrolled fully into view", async ({ page }) => {
  await openDiary(page, `e2e-day-scroll-end-${Date.now()}`);
  await scrollToEndOfDay(page);

  const geometry = await page.evaluate((sel) => {
    const wrapper = document.querySelector(sel);
    const wrapperRect = wrapper.getBoundingClientRect();
    const visible = (el) => el.offsetParent !== null && el.getBoundingClientRect().height > 0;
    const markers = [...wrapper.querySelectorAll('.hour-marker')].filter(visible);
    const labels = [...wrapper.querySelectorAll('.hour-label')].filter(visible);
    const last = markers[markers.length - 1];
    const lastLabel = labels[labels.length - 1];
    return {
      markerCount: markers.length,
      labelCount: labels.length,
      lastLineBottom: last ? last.getBoundingClientRect().bottom : null,
      lastLabelBottom: lastLabel ? lastLabel.getBoundingClientRect().bottom : null,
      wrapperBottom: wrapperRect.bottom,
    };
  }, WRAPPER);

  // The premise: the day ends with hour lines, and the last one is the end of
  // the day. Without that a passing assertion below would be meaningless.
  expect(geometry.markerCount, 'the day needs its hour lines').toBeGreaterThan(20);
  expect(geometry.labelCount, 'the day needs its hour labels').toBeGreaterThan(20);

  // The reported symptom was a line that could not be seen at all; anything at
  // or below 0 means it is on, or past, the edge of the scroller.
  const roomBelowLine = geometry.wrapperBottom - geometry.lastLineBottom;
  expect(
    roomBelowLine,
    "the day's last hour line has to come fully into view, with room to spare"
  ).toBeGreaterThan(8);
  expect(
    geometry.wrapperBottom - geometry.lastLabelBottom,
    'the last hour label has to stay inside the scroller too'
  ).toBeGreaterThan(8);

  // ... and the scroller itself has to end on screen. The tail above was once
  // there and invisible: `.timeline-canvas` carried a 20px vertical margin on
  // top of a height that already subtracted header and footer, so the scroller's
  // bottom edge sat below the viewport (measured 935px in a 915px viewport) and
  // the day's last 20px - exactly the reserved tail - were off screen.
  const viewportFit = await page.evaluate((sel) => {
    const rect = document.querySelector(sel).getBoundingClientRect();
    return { bottom: rect.bottom, viewportHeight: window.innerHeight };
  }, WRAPPER);
  expect(
    viewportFit.bottom,
    `the day scroller must end within the viewport (bottom ${viewportFit.bottom}, viewport ${viewportFit.viewportHeight})`
  ).toBeLessThanOrEqual(viewportFit.viewportHeight + 1);
});

test('pull-to-refresh stays off without a document-level touchmove listener', async ({
  page,
}) => {
  await openDiary(page, `e2e-day-scroll-overscroll-${Date.now()}`);

  // The touchmove fallback that used to guard pull-to-refresh was what cancelled
  // the downward drags, so the protection now rests on overscroll-behavior
  // alone: it has to be set on the root element (the viewport) *and* on the body
  // (Safari reads that one).
  const overscroll = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overscrollBehaviorY,
    body: getComputedStyle(document.body).overscrollBehaviorY,
  }));
  expect(overscroll.html, 'the root element is what disables the browser gesture').toBe(
    'none'
  );
  expect(overscroll.body, 'Safari reads the value on the body').toBe('none');
});
