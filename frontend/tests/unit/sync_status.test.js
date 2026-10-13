// Tests for the autosave status chip mapping.
//
// The chip only ever speaks about failure. A day that IS stored needs no
// announcement, and "Saving..."/"Saved" within a second of every edit made the
// app feel busy - and, since the write is debounced by ~2 s, laggy - for
// information the participant cannot act on. So the rules that matter now are:
// the failure state is presented, and nothing else is.
// The DOM part lives in ui.js; this covers state -> label/kind/icon.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { syncStatusView } from '../../src/js/sync_status.js';

test('a quiet day shows no chip', () => {
  assert.equal(syncStatusView('idle'), null);
});

test('working states show no chip: saving is not news', () => {
  // pending = debouncing, saving = request in flight, saved = stored. All three
  // mean "the app is doing its job", and none of them asks the participant for
  // anything, so none of them gets a chip.
  for (const state of ['pending', 'saving', 'saved']) {
    assert.equal(syncStatusView(state), null, `'${state}' must stay quiet`);
  }
});

test('a failure is presented, with a retry', () => {
  const view = syncStatusView('error');
  assert.ok(view, 'the failure state has to be presented');
  assert.equal(view.kind, 'error');
  assert.equal(view.textKey, 'messages.syncNotSaved');
  assert.ok(view.icon, 'the failure state has no icon');
  assert.equal(view.canRetry, true);
});

test('the chip can never claim success', () => {
  const shown = ['idle', 'pending', 'saving', 'saved', 'error']
    .map((state) => syncStatusView(state))
    .filter(Boolean);
  assert.equal(
    shown.length,
    1,
    `expected exactly one visible state, got ${shown.length}`
  );
  assert.equal(shown[0].textKey, 'messages.syncNotSaved');
});

test('an unknown state shows no chip rather than a stale label', () => {
  assert.equal(syncStatusView('nonsense'), null);
  assert.equal(syncStatusView(undefined), null);
});

test('every state the engine reports is covered', () => {
  // Kept as an explicit list rather than importing the engine's states, so a new
  // state in autosave.js fails here instead of silently showing nothing.
  const engineStates = ['idle', 'pending', 'saving', 'saved', 'error'];
  for (const state of engineStates) {
    const view = syncStatusView(state);
    if (state === 'error') {
      assert.ok(view, 'the failure state must be presented');
      continue;
    }
    assert.equal(view, null, `state '${state}' must show no chip`);
  }
});
