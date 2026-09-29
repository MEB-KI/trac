// Unit tests for the stale-locale handling in the i18n module:
//  * locale files are always revalidated (a cached copy renders a half
//    translated page: missing keys silently keep the markup's English text)
//  * a locale that turned out to be incomplete is re-fetched once, with a
//    cache-buster, and the fresh file is applied
//  * optional lookups / data-i18n-alt do not report false "missing key"s
import './setup.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import i18n from '../../src/js/i18n.js';

const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;
const originalFetch = globalThis.fetch;

afterEach(() => {
  console.warn = originalWarn;
  console.error = originalError;
  console.info = originalInfo;
  globalThis.fetch = originalFetch;
});

/** @returns {{calls: Array<{url: string, options: any}>, fetch: Function}} */
function stubFetch(bodiesByUrl) {
  const calls = [];
  const stub = async (url, options = {}) => {
    calls.push({ url, options });
    const match = Object.entries(bodiesByUrl).find(([needle]) =>
      String(url).includes(needle)
    );
    if (!match) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => match[1] };
  };
  globalThis.fetch = stub;
  return { calls, fetch: stub };
}

test('loadTranslations revalidates instead of trusting a cached locale file', async () => {
  const { calls } = stubFetch({ 'de.json': { instructions: { title: 'Anleitung' } } });

  const translations = await i18n.loadTranslations('de');

  assert.deepEqual(translations, { instructions: { title: 'Anleitung' } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.cache, 'no-cache');
  assert.ok(!calls[0].url.includes('?v='), 'plain loads must not bust the cache');
});

test('loadTranslations can append a cache-buster when asked', async () => {
  const { calls } = stubFetch({ 'de.json': { instructions: {} } });

  await i18n.loadTranslations('de', { bustCache: true });

  assert.match(calls[0].url, /de\.json\?v=\d+$/);
});

test('a missing key is recorded and reported to the console', () => {
  i18n.isLoaded = true;
  i18n.translations = { instructions: { title: 'Anleitung' } };
  i18n.missingKeys.clear();
  const warnings = [];
  console.warn = (message) => warnings.push(String(message));

  assert.equal(i18n.t('instructions.step4.title'), 'instructions.step4.title');
  assert.deepEqual([...i18n.missingKeys], ['instructions.step4.title']);
  assert.deepEqual(warnings, ['Translation not found for key: instructions.step4.title']);
});

test('tOptional and has() do not warn and do not record missing keys', () => {
  i18n.isLoaded = true;
  i18n.translations = { buttons: { ok: 'OK' } };
  i18n.missingKeys.clear();
  const warnings = [];
  console.warn = (message) => warnings.push(String(message));

  assert.equal(i18n.tOptional('footer.imprint'), null);
  assert.equal(i18n.has('footer.imprint'), false);
  assert.equal(i18n.tOptional('buttons.ok'), 'OK');
  assert.equal(i18n.has('buttons.ok'), true);
  assert.deepEqual([...i18n.missingKeys], []);
  assert.deepEqual(warnings, []);
});

test('tOptional interpolates like t()', () => {
  i18n.isLoaded = true;
  i18n.translations = { messages: { hello: 'Hi {{name}}' } };
  assert.equal(i18n.tOptional('messages.hello', { name: 'Ada' }), 'Hi Ada');
});

test('repairMissingTranslations re-fetches with a cache-buster and applies the fresh locale', async () => {
  const stale = { instructions: { step3: { title: 'Tagebuch absenden' } } };
  const fresh = {
    instructions: {
      step3: { title: 'Einen Tag kopieren' },
      step4: { title: 'Tagebuch speichern und absenden' },
    },
  };

  i18n.currentLanguage = 'de';
  i18n.isLoaded = true;
  i18n.translations = stale;
  i18n.missingKeys.clear();
  i18n.t('instructions.step4.title'); // stale file is missing this key

  let serveFresh = false;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => (serveFresh && String(url).includes('?v=') ? fresh : stale),
    };
  };
  console.info = () => {};
  console.error = () => {};

  serveFresh = true;
  const repaired = await i18n.repairMissingTranslations();

  assert.equal(repaired, true, 'repair reports that a fresher file was applied');
  assert.equal(calls.length, 1, 'exactly one extra request is made');
  assert.match(calls[0].url, /de\.json\?v=\d+$/);
  assert.deepEqual(i18n.translations, fresh);
  assert.deepEqual([...i18n.missingKeys], [], 'no keys missing after the repair');
});

test('repairMissingTranslations reports keys that are really missing (nothing to heal)', async () => {
  i18n.currentLanguage = 'de';
  i18n.isLoaded = true;
  i18n.translations = { instructions: {} };
  i18n.missingKeys.clear();
  i18n.t('instructions.step4.title');

  const errors = [];
  console.error = (message) => errors.push(String(message));
  console.info = () => {};
  stubFetch({ 'de.json': { instructions: {} } });

  const repaired = await i18n.repairMissingTranslations();

  assert.equal(repaired, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /locale 'de' \(de\.json\) is missing 1 key\(s\)/);
  assert.match(errors[0], /instructions\.step4\.title/);
});

test('repairMissingTranslations does nothing when no key was missing', async () => {
  i18n.currentLanguage = 'de';
  i18n.isLoaded = true;
  i18n.translations = { instructions: { title: 'Anleitung' } };
  i18n.missingKeys.clear();
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, status: 200, json: async () => ({}) };
  };

  assert.equal(await i18n.repairMissingTranslations(), false);
  assert.deepEqual(calls, [], 'no request for a complete locale');
});

/** Minimal element stub for applyTranslations(). */
function fakeElement(attributes = {}) {
  const attrs = { ...attributes };
  return {
    attrs,
    textContent: '',
    innerHTML: '',
    title: '',
    alt: '',
    placeholder: '',
    value: '',
    getAttribute(name) {
      return name in attrs ? attrs[name] : null;
    },
    setAttribute(name, value) {
      attrs[name] = value;
    },
  };
}

function fakeContainer(elementsBySelector) {
  return {
    querySelectorAll(selector) {
      return elementsBySelector[selector] || [];
    },
  };
}

test('applyTranslations wires alt text through data-i18n-alt', () => {
  i18n.isLoaded = true;
  i18n.translations = {
    instructions: { step1: { imageAltHorizontal: 'Auswahl einer Aktivität' } },
  };
  i18n.missingKeys.clear();
  const img = fakeElement({ 'data-i18n-alt': 'instructions.step1.imageAltHorizontal' });

  i18n.applyTranslations(fakeContainer({ '[data-i18n-alt]': [img] }));

  assert.equal(img.alt, 'Auswahl einer Aktivität');
  assert.deepEqual([...i18n.missingKeys], []);
});
