// Guards the *values* of the translation files, not just their key sets.
//
// locales_consistency.test.js checks that all locales share the same keys and
// are not left in English. It cannot see a value that is still broken:
//
//  * ``{{placeholder}}`` renamed or dropped while translating -> the page shows
//    the raw "{{days}}" text,
//  * an HTML tag that was rewritten or left unclosed -> broken markup and (with
//    data-i18n-html) visible tags in the page.
//
// Both stay invisible until somebody reads that language in production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCALES_DIR = fileURLToPath(new URL('../../src/locales/', import.meta.url));

const localeFiles = readdirSync(LOCALES_DIR)
  .filter((file) => file.endsWith('.json'))
  .sort();

const parsed = {};
for (const file of localeFiles) {
  parsed[file] = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8'));
}

const REFERENCE = 'en.json';

function flatten(obj, prefix = '') {
  const out = new Map();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [childKey, childValue] of flatten(value, path)) {
        out.set(childKey, childValue);
      }
    } else {
      out.set(path, value);
    }
  }
  return out;
}

function placeholders(value) {
  return [...value.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)]
    .map((match) => match[1])
    .sort();
}

const SELF_CLOSING = new Set(['br', 'img', 'input', 'hr', 'meta', 'link']);

/**
 * Tag names in document order, plus the tags that are never closed again.
 * @param {string} value
 * @returns {{tags: string[], unclosed: string[]}}
 */
function tagStructure(value) {
  const tags = [];
  const unclosed = [];
  const stack = [];

  for (const match of value.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = match;
    const tag = name.toLowerCase();
    tags.push(tag);
    if (selfClosing || SELF_CLOSING.has(tag)) continue;

    if (closing) {
      if (stack[stack.length - 1] === tag) {
        stack.pop();
      } else {
        unclosed.push(`</${tag}>`);
      }
    } else {
      stack.push(tag);
    }
  }

  return { tags, unclosed: [...unclosed, ...stack.map((tag) => `<${tag}>`)] };
}

test('placeholder sets match the reference locale for every key', () => {
  const reference = flatten(parsed[REFERENCE]);
  const problems = [];

  for (const file of localeFiles) {
    if (file === REFERENCE) continue;
    const values = flatten(parsed[file]);
    for (const [key, value] of values) {
      if (typeof value !== 'string') continue;
      const expected = placeholders(reference.get(key) || '');
      const actual = placeholders(value);
      if (expected.join(',') !== actual.join(',')) {
        problems.push(`${file} ${key}: en has [${expected}], ${file} has [${actual}]`);
      }
    }
  }

  assert.deepEqual(problems, [], `placeholder mismatch:\n${problems.join('\n')}`);
});

test('HTML in translation values is balanced and matches the reference tags', () => {
  const reference = flatten(parsed[REFERENCE]);
  const problems = [];

  for (const file of localeFiles) {
    const values = flatten(parsed[file]);
    for (const [key, value] of values) {
      if (typeof value !== 'string' || !value.includes('<')) continue;

      const { tags, unclosed } = tagStructure(value);
      if (unclosed.length > 0) {
        problems.push(`${file} ${key}: unbalanced ${unclosed.join(' ')}`);
        continue;
      }

      const expected = tagStructure(reference.get(key) || '').tags.sort();
      if (tags.sort().join(',') !== expected.join(',')) {
        problems.push(
          `${file} ${key}: tags [${tags}] do not match en [${expected}]`,
        );
      }
    }
  }

  assert.deepEqual(problems, [], `HTML mismatch:\n${problems.join('\n')}`);
});
