// Tests for the timeline overlap check used by the drag/resize/undo handlers.
//
// It compares absolute minutes-of-day, and it used to compare `new Date(...)` of
// display strings like "07:30" or "00:30(+1)" - which are Invalid Dates (NaN) in
// every engine, so the check never fired and callers never reverted a bad drag.
// These tests fail if that regresses (and they are timezone independent, since
// minutes-of-day carry no date).
import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Timeline } from '../../src/js/timeline.js';
import { timeToMinutes } from '../../src/js/utils.js';

/** @returns {Timeline} a timeline whose activities are managed via window.timelineManager */
function timelineWith(activities) {
  window.timelineManager = { activities: { primary: activities } };
  return new Timeline('primary');
}

/** Activity as the diary stores it (display strings, no dates). */
function activity(activity, startTime, endTime, extra = {}) {
  return { activity, startTime, endTime, ...extra };
}

test('timeToMinutes handles display strings, (+1) notation and numbers', () => {
  assert.equal(timeToMinutes('07:30'), 450);
  assert.equal(timeToMinutes('00:30(+1)'), 1470);
  assert.equal(timeToMinutes('04:00'), 240);
  assert.equal(timeToMinutes('1440'), 1440);
  assert.equal(timeToMinutes(300), 300);
  assert.ok(Number.isNaN(timeToMinutes('not a time')));
  assert.ok(Number.isNaN(timeToMinutes(null)));
});

test('overlapping activities are rejected', () => {
  const timeline = timelineWith([
    activity('Sleeping', '06:00', '08:00'),
    activity('Working', '07:30', '09:00'),
  ]);

  assert.throws(
    () => timeline.validate(),
    /Overlap detected between activities "Sleeping" and "Working"/,
  );
});

test('overlap is detected regardless of the order of the activities', () => {
  // The broken implementation sorted by Invalid Date (NaN), so an unsorted,
  // overlapping pair slipped through. Activity 2 starts before activity 1.
  const timeline = timelineWith([
    activity('Working', '07:30', '09:00'),
    activity('Sleeping', '06:00', '08:00'),
  ]);

  assert.throws(() => timeline.validate(), /Overlap detected/);
});

test('touching activities are fine', () => {
  const timeline = timelineWith([
    activity('Sleeping', '06:00', '08:00'),
    activity('Working', '08:00', '09:00'),
  ]);

  assert.equal(timeline.validate(), true);
});

test('activities across midnight are compared on the (+1) scale', () => {
  const timeline = timelineWith([
    activity('Working', '23:00', '00:30(+1)'),
    activity('Sleeping', '01:00(+1)', '04:00(+1)'),
  ]);

  assert.equal(timeline.validate(), true);

  const overlapping = timelineWith([
    activity('Working', '23:00', '01:30(+1)'),
    activity('Sleeping', '00:30(+1)', '04:00(+1)'),
  ]);

  assert.throws(() => overlapping.validate(), /Overlap detected/);
});

test('activities are compared on the minutes fields when present', () => {
  const timeline = timelineWith([
    activity('Sleeping', '06:00', '08:00', { startMinutes: 360, endMinutes: 480 }),
    activity('Working', '07:00', '09:00', { startMinutes: 420, endMinutes: 540 }),
  ]);

  assert.throws(() => timeline.validate(), /Overlap detected/);
});

test('activities without usable times are skipped instead of failing', () => {
  const timeline = timelineWith([
    activity('Sleeping', '06:00', '08:00'),
    activity('Broken', 'tomorrow', 'later'),
    activity('Working', '09:00', '10:00'),
  ]);

  assert.equal(timeline.validate(), true);
});

test('a timeline without activities or without a manager entry is valid', () => {
  assert.equal(timelineWith([]).validate(), true);

  window.timelineManager = { activities: {} };
  assert.equal(new Timeline('missing').validate(), true);
});
