// Unit tests for the shared API request helpers (api_request.js).
//
// Two behaviours matter and are guarded here:
//   1. transient failures (dropped connection, 5xx) are retried a bounded number
//      of times, so a backend restart during maintenance does not look like a
//      permanent failure to the participant;
//   2. client errors (4xx) are handed back to the caller untouched, and the
//      failure classifier tells a *permanent* problem (broken/expired link,
//      paused study, already submitted) apart from a *temporary* one - the UI
//      must not answer a permanent problem with "please try again".
import './setup.js';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyApiFailure,
  fetchWithRetry,
  NO_STUDIES_AVAILABLE,
  STUDY_PARTICIPANT_ID_REQUIRED,
} from '../../src/js/api_request.js';

const realFetch = globalThis.fetch;
const URL_UNDER_TEST = 'https://example.test/api/studies/demo/study-config';

/** Minimal stand-in for a Response: only `ok`/`status` are read. */
function fakeResponse(status) {
  return { ok: status >= 200 && status < 300, status, json: async () => ({}) };
}

/**
 * Replace global fetch with a stub that records every call.
 * @param {(attempt: number, url: string, options: RequestInit) => unknown} handler
 */
function installFetchStub(handler) {
  /** @type {Array<{url: string, options: RequestInit}>} */
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return handler(calls.length, String(url), options);
  };
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

test('succeeds on the first attempt without retrying', async () => {
  const calls = installFetchStub(() => fakeResponse(200));

  const response = await fetchWithRetry(
    URL_UNDER_TEST,
    {},
    { maxRetries: 2, delayMs: 1 }
  );

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
});

test('retries 5xx responses and throws after the last attempt', async () => {
  const calls = installFetchStub(() => fakeResponse(503));

  await assert.rejects(
    () => fetchWithRetry(URL_UNDER_TEST, {}, { maxRetries: 2, delayMs: 1 }),
    /HTTP 503/
  );

  // one initial attempt plus two retries
  assert.equal(calls.length, 3);
});

test('returns 4xx responses to the caller instead of retrying them', async () => {
  const calls = installFetchStub(() => fakeResponse(403));

  const response = await fetchWithRetry(
    URL_UNDER_TEST,
    {},
    { maxRetries: 2, delayMs: 1 }
  );

  assert.equal(response.status, 403);
  assert.equal(calls.length, 1, 'client errors must not be retried');
});

test('retries dropped connections and repeats the request unchanged', async () => {
  const calls = installFetchStub((attempt) => {
    if (attempt < 3) throw new TypeError('Failed to fetch');
    return fakeResponse(200);
  });

  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent_given: true }),
  };
  const response = await fetchWithRetry(URL_UNDER_TEST, options, {
    maxRetries: 2,
    delayMs: 1,
  });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.map((call) => call.options.method),
    ['POST', 'POST', 'POST'],
    'every retry must repeat method and body'
  );
  assert.equal(calls[2].options.body, options.body);
});

test('reports each retry through onRetry and stops at maxRetries', async () => {
  installFetchStub(() => fakeResponse(502));
  const reported = [];

  await assert.rejects(() =>
    fetchWithRetry(URL_UNDER_TEST, {}, {
      maxRetries: 1,
      delayMs: 1,
      onRetry: (attempt, delay, error) =>
        reported.push({ attempt, delay, message: error.message }),
    })
  );

  assert.deepEqual(reported, [{ attempt: 1, delay: 1, message: 'HTTP 502' }]);
});

test('classifies a missing study as a broken link, not a server problem', () => {
  const error = new Error('No studies available.');
  error.code = NO_STUDIES_AVAILABLE;
  assert.equal(classifyApiFailure(error), 'denied');

  const missingPid = new Error('Missing participant id');
  missingPid.code = STUDY_PARTICIPANT_ID_REQUIRED;
  assert.equal(classifyApiFailure(missingPid), 'denied');
});

test('classifies HTTP failures by status and error code', () => {
  assert.equal(classifyApiFailure({ status: 404 }), 'notFound');
  assert.equal(classifyApiFailure({ status: 400 }), 'denied');
  assert.equal(
    classifyApiFailure({ status: 403, code: 'study_access_denied' }),
    'denied'
  );
  // Paused study / outside the collection window: the link is fine, the study
  // is closed - a later attempt can work.
  assert.equal(
    classifyApiFailure({ status: 403, code: 'study_unavailable' }),
    'unavailable'
  );
  assert.equal(classifyApiFailure({ status: 422 }), 'denied');
  assert.equal(classifyApiFailure({ status: 500 }), 'temporary');
  assert.equal(classifyApiFailure({ status: 503 }), 'temporary');
});

test('treats network failures and unknown errors as temporary', () => {
  assert.equal(classifyApiFailure(new TypeError('Failed to fetch')), 'temporary');
  assert.equal(classifyApiFailure(new Error('HTTP 502')), 'temporary');
  assert.equal(classifyApiFailure(null), 'temporary');
  assert.equal(classifyApiFailure(undefined), 'temporary');
  assert.equal(classifyApiFailure('boom'), 'temporary');
});
