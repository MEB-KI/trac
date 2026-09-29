// Tests for the diary draft storage (sessionStorage + localStorage).
//
// The interesting cases are the ones that cannot happen on a developer
// machine: storage that throws (Safari private mode, "block all cookies"),
// quota exceeded, a payload written by an older app version, and a draft from a
// different participant who used the same browser. None of these may break the
// diary, and none of them may restore somebody else's or an unusable state.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DRAFT_TIMELINE_MAX_AGE_MS,
  DRAFT_TIMELINE_STATE_KEY,
  PENDING_TIMELINE_STATE_KEY,
  clearTimelineState,
  isStoredTimelineStateFresh,
  matchesTimelineContext,
  normalizeTimelineState,
  readStoredTimelineState,
  safeGetItem,
  safeSetItem,
  storeTimelineState,
} from '../../src/js/draft_storage.js';

const originalWarn = console.warn;
console.warn = () => {};

/** In-memory Storage stub. */
function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
    _data: data,
  };
}

/** Storage whose every operation throws (blocked cookies / private mode). */
function throwingStorage() {
  return {
    getItem() {
      throw new Error('storage is not available');
    },
    setItem() {
      throw new Error('storage is not available');
    },
    removeItem() {
      throw new Error('storage is not available');
    },
  };
}

/** Storage that fails only on writes (quota exceeded). */
function fullStorage(initial = {}) {
  const inner = memoryStorage(initial);
  return {
    getItem: inner.getItem,
    removeItem: inner.removeItem,
    setItem() {
      throw new Error('QuotaExceededError');
    },
    _data: inner._data,
  };
}

function payload(overrides = {}) {
  return {
    pid: 'alice',
    study_name: 'default',
    day_label_index: '0',
    savedAt: Date.now(),
    currentIndex: 0,
    activities: [{ id: 1, timelineKey: 'primary', startTime: 600 }],
    ...overrides,
  };
}

test('a stored draft round-trips', () => {
  const storage = memoryStorage();
  assert.equal(storeTimelineState(storage, DRAFT_TIMELINE_STATE_KEY, payload()), true);

  const restored = readStoredTimelineState(storage, DRAFT_TIMELINE_STATE_KEY);
  assert.equal(restored.pid, 'alice');
  assert.equal(restored.day_label_index, '0');
  assert.equal(restored.activities.length, 1);
  assert.equal(restored.activities[0].timelineKey, 'primary');
});

test('writing to a full storage reports failure instead of throwing', () => {
  const storage = fullStorage();
  assert.equal(storeTimelineState(storage, DRAFT_TIMELINE_STATE_KEY, payload()), false);
});

test('reading from unavailable storage returns null instead of throwing', () => {
  const storage = throwingStorage();
  assert.equal(readStoredTimelineState(storage, DRAFT_TIMELINE_STATE_KEY), null);
  assert.equal(safeGetItem(storage, DRAFT_TIMELINE_STATE_KEY), null);
  assert.equal(safeSetItem(storage, DRAFT_TIMELINE_STATE_KEY, 'x'), false);
});

test('corrupt JSON is discarded and cleared', () => {
  const storage = memoryStorage({ [DRAFT_TIMELINE_STATE_KEY]: '{not json' });

  assert.equal(readStoredTimelineState(storage, DRAFT_TIMELINE_STATE_KEY), null);
  assert.equal(DRAFT_TIMELINE_STATE_KEY in storage._data, false);
});

test('structurally unusable payloads are discarded and cleared', () => {
  const cases = [
    'null',
    '[]',
    '"text"',
    '{}',
    '{"pid":"alice","activities":{}}',
    '{"pid":"alice","activities":[{"noTimelineKey":true}]}',
    '{"pid":"alice","activities":[{"timelineKey":"   "}]}',
  ];

  for (const raw of cases) {
    const storage = memoryStorage({ [DRAFT_TIMELINE_STATE_KEY]: raw });
    assert.equal(
      readStoredTimelineState(storage, DRAFT_TIMELINE_STATE_KEY),
      null,
      `expected ${raw} to be rejected`,
    );
    assert.equal(
      DRAFT_TIMELINE_STATE_KEY in storage._data,
      false,
      `expected ${raw} to be cleared`,
    );
  }
});

test('activities without a timeline key are dropped, the rest is kept', () => {
  const normalized = normalizeTimelineState({
    pid: 'alice',
    activities: [
      { timelineKey: 'primary' },
      { timelineKey: '' },
      null,
      'nonsense',
      { timelineKey: 'secondary' },
    ],
  });

  assert.equal(normalized.activities.length, 2);
  assert.deepEqual(
    normalized.activities.map((activity) => activity.timelineKey),
    ['primary', 'secondary'],
  );
});

test('a draft older than the max age is not fresh', () => {
  const now = 1_700_000_000_000;

  assert.equal(isStoredTimelineStateFresh({ savedAt: now }, now), true);
  assert.equal(
    isStoredTimelineStateFresh({ savedAt: now - DRAFT_TIMELINE_MAX_AGE_MS - 1 }, now),
    false,
  );
  assert.equal(isStoredTimelineStateFresh({ savedAt: 'yesterday' }, now), false);
  assert.equal(isStoredTimelineStateFresh({}, now), false);
  assert.equal(isStoredTimelineStateFresh(null, now), false);
});

test('the context check separates participant, study and day', () => {
  const draft = payload({ pid: 'alice', study_name: 'default', day_label_index: '2' });

  assert.equal(
    matchesTimelineContext(draft, {
      pid: 'alice',
      study_name: 'default',
      day_label_index: '2',
    }),
    true,
  );
  // Another participant on the same browser must not inherit the draft.
  assert.equal(
    matchesTimelineContext(draft, {
      pid: 'bob',
      study_name: 'default',
      day_label_index: '2',
    }),
    false,
  );
  assert.equal(
    matchesTimelineContext(draft, {
      pid: 'alice',
      study_name: 'other',
      day_label_index: '2',
    }),
    false,
  );
  assert.equal(
    matchesTimelineContext(draft, {
      pid: 'alice',
      study_name: 'default',
      day_label_index: '3',
    }),
    false,
  );
});

test('clearTimelineState removes both copies and survives broken storage', () => {
  const sessionStorage = memoryStorage({ [PENDING_TIMELINE_STATE_KEY]: 'x' });
  const localStorage = memoryStorage({ [DRAFT_TIMELINE_STATE_KEY]: 'y' });

  clearTimelineState({ sessionStorage, localStorage });

  assert.equal(PENDING_TIMELINE_STATE_KEY in sessionStorage._data, false);
  assert.equal(DRAFT_TIMELINE_STATE_KEY in localStorage._data, false);

  assert.doesNotThrow(() =>
    clearTimelineState({
      sessionStorage: throwingStorage(),
      localStorage: throwingStorage(),
    }),
  );
  assert.doesNotThrow(() => clearTimelineState());
});

console.warn = originalWarn;
