// Guards the second half of the i18n contract: every key that the pages and
// scripts actually ask for must exist in every locale file.
//
// The other direction (all locales share the same key set) is covered by
// locales_consistency.test.js. This test closes the remaining gap: a key that
// is referenced from markup/JS but missing from a locale is *not* an error at
// runtime - applyTranslations() simply leaves the built-in English text of the
// markup in place - which is exactly how half-translated pages ("German
// heading, English body") happen, and how `timeout.title` stayed English.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = fileURLToPath(new URL('../../src/', import.meta.url));
const LOCALES_DIR = join(SRC_DIR, 'locales');

function flattenKeys(obj, prefix = '') {
  const keys = new Set();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.add(path);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const child of flattenKeys(value, path)) keys.add(child);
    }
  }
  return keys;
}

const localeFiles = readdirSync(LOCALES_DIR)
  .filter((file) => file.endsWith('.json'))
  .sort();

const parsedLocales = {};
for (const file of localeFiles) {
  parsedLocales[file] = JSON.parse(
    readFileSync(join(LOCALES_DIR, file), 'utf8')
  );
}

function walk(dir, predicate, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, predicate, out);
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

const rel = (file) => relative(SRC_DIR, file).split(sep).join('/');

// A translation key is a dotted, lowerCamelCase path (every leaf in the locale
// files is nested, so a dot is always present). Requiring that shape keeps this
// scan from picking up unrelated string literals.
const KEY_SHAPE = /^[a-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const PLACEHOLDER_BUILDERS = /\$\{/; // template-literal key parts, not literals

const DATA_I18N_RE = /data-i18n(?:-[a-z-]+)?\s*=\s*["'`]([^"'`]+)["'`]/g;
const LOOKUP_CALL_RE = /\bt(?:Optional)?\s*\(\s*["'`]([^"'`]+)["'`]/g;

/**
 * Collect i18n keys requested by a file: `data-i18n*` attributes in markup or
 * in generated markup templates, plus literal `t('key')` / `tOptional('key')`
 * lookups.
 * @param {string} source
 * @returns {Set<string>}
 */
function collectRequestedKeys(source) {
  const keys = new Set();

  const add = (key) => {
    const candidate = String(key).trim();
    if (PLACEHOLDER_BUILDERS.test(candidate)) return; // built at runtime
    if (KEY_SHAPE.test(candidate)) keys.add(candidate);
  };

  for (const match of source.matchAll(DATA_I18N_RE)) add(match[1]);
  for (const match of source.matchAll(LOOKUP_CALL_RE)) add(match[1]);

  return keys;
}

// Every page (markup) and every script that can translate markup.
const SOURCE_FILES = [
  ...walk(SRC_DIR, (file) => file.endsWith('.html')),
  ...walk(join(SRC_DIR, 'js'), (file) => file.endsWith('.js')),
  ...walk(join(SRC_DIR, 'pages'), (file) => file.endsWith('.js')),
].sort();

test('at least one source file and locale is scanned', () => {
  assert.ok(SOURCE_FILES.length > 10, 'expected to scan many source files');
  assert.ok(localeFiles.length >= 2, 'expected at least 2 locale files');
});

test('every i18n key requested by markup or scripts exists in every locale', () => {
  const missingByLocale = {};
  for (const file of localeFiles) {
    missingByLocale[file] = [];
  }

  for (const sourceFile of SOURCE_FILES) {
    const keys = collectRequestedKeys(readFileSync(sourceFile, 'utf8'));
    if (keys.size === 0) continue;

    for (const file of localeFiles) {
      const available = flattenKeys(parsedLocales[file]);
      for (const key of keys) {
        if (!available.has(key)) {
          missingByLocale[file].push(`${key} (used by ${rel(sourceFile)})`);
        }
      }
    }
  }

  const problems = Object.entries(missingByLocale)
    .filter(([, missing]) => missing.length > 0)
    .map(([file, missing]) => `${file}: ${missing.join(', ')}`);

  assert.deepEqual(
    problems,
    [],
    `locale files are missing keys that pages/scripts request:\n${problems.join('\n')}`
  );
});

// A hardcoded string in a stylesheet cannot be translated at all, and the
// fallback markup pattern ("Loading..." in CSS) produced user-visible English
// text on otherwise localized pages.
test('page stylesheets contain no hardcoded textual content', () => {
  const stylesheets = walk(
    SRC_DIR,
    (file) =>
      file.endsWith('.css') &&
      !rel(file).includes('fontawesome') &&
      !rel(file).includes('assets/'),
  );

  const offenders = [];
  for (const file of stylesheets) {
    const source = readFileSync(file, 'utf8');
    // content: 'text'  |  content: "text"   (skip escapes like content: '\f00c')
    for (const match of source.matchAll(
      /content\s*:\s*(["'])([^"'\\]*)\1\s*;/g
    )) {
      const value = match[2].trim();
      if (/[A-Za-z]{2,}/.test(value)) {
        offenders.push(`${rel(file)}: content: "${value}"`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'move user-visible text out of CSS into the locale files (data-i18n)'
  );
});
