// Which studies get timeline tabs on a phone.
//
// `shouldShowTimelineTabs()` lives in constants.js so the rule is testable at
// all: every study we ship carries exactly two timelines, and a stubbed
// activities config whose timeline set disagrees with the study config does not
// bring the diary up (measured - the timeline never initializes), so the one- and
// three-timeline branches cannot be reached over E2E.
//
// The rule itself: two is the case the tabs exist for (both names on screen is
// what makes the second timeline noticeable without opening anything, and two
// names fit the strip's own row). One has nothing to switch to and hides, more
// than two would run off the row and keeps the picker, which can list any number.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shouldShowTimelineTabs } from '../../src/js/constants.js';

test('exactly two timelines get tabs', () => {
  assert.equal(shouldShowTimelineTabs(2), true);
});

test('a single timeline has nothing to switch to, so the switcher hides', () => {
  assert.equal(shouldShowTimelineTabs(1), false);
  assert.equal(shouldShowTimelineTabs(0), false);
});

test('three or more keep the picker, which can list any number of them', () => {
  assert.equal(shouldShowTimelineTabs(3), false);
  assert.equal(shouldShowTimelineTabs(4), false);
});
