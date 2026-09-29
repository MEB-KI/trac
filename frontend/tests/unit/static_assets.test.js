// Guards against references to frontend assets that do not exist.
//
// A missing image/stylesheet/font is invisible in the other suites (nothing
// loads the real files) but shows up as a broken image or an unstyled page for
// participants - the same "only the deployment notices" class as the stale
// locale file bug.
//
// Scope: HTML and CSS. Their paths resolve against the document or the
// stylesheet, so a reference can be checked from the source file. Paths built in
// JavaScript are document-relative at runtime (or assembled from configuration)
// and cannot be resolved statically.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = fileURLToPath(new URL('../../src/', import.meta.url));

const ASSET_EXTENSIONS = [
  'gif',
  'png',
  'jpg',
  'jpeg',
  'svg',
  'ico',
  'webp',
  'css',
  'js',
  'json',
  'woff',
  'woff2',
  'ttf',
];

function walk(dir, predicate, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, predicate, out);
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

const rel = (file) => relative(SRC_DIR, file).split(sep).join('/');

/**
 * Is this a reference to a file inside the frontend that we can check?
 * External URLs, data URIs, anchors and runtime-built paths are ignored.
 * @param {string} ref
 * @returns {boolean}
 */
function isCheckableLocalRef(ref) {
  if (!ref || typeof ref !== 'string') return false;
  if (ref.includes('${') || ref.includes('{{')) return false; // built at runtime
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return false; // http:, data:, mailto:
  if (ref.startsWith('//') || ref.startsWith('#') || ref.startsWith('?')) {
    return false;
  }
  return new RegExp(`\\.(${ASSET_EXTENSIONS.join('|')})$`, 'i').test(ref);
}

/**
 * Remove comments: index.html still carries a commented-out old test harness
 * include, and stylesheets keep commented-out rules around.
 * @param {string} source
 * @param {string} ext
 * @returns {string}
 */
function stripComments(source, ext) {
  return ext === 'html'
    ? source.replace(/<!--[\s\S]*?-->/g, '')
    : source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Collect the local asset references of one HTML/CSS file.
 * @param {string} file
 * @param {string} rawSource
 * @returns {string[]}
 */
function collectReferences(file, rawSource) {
  const ext = file.split('.').pop().toLowerCase();
  const source = stripComments(rawSource, ext);
  const refs = [];

  if (ext === 'html') {
    for (const match of source.matchAll(
      /\b(?:src|href|data-src)\s*=\s*["']([^"']+)["']/g,
    )) {
      refs.push(match[1]);
    }
  } else if (ext === 'css') {
    for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      refs.push(match[1]);
    }
  }

  return refs.filter(isCheckableLocalRef);
}

test('every asset referenced by HTML and CSS exists in the repository', () => {
  const sources = [
    ...walk(SRC_DIR, (file) => file.endsWith('.html')),
    ...walk(SRC_DIR, (file) => file.endsWith('.css')),
  ];

  const missing = [];
  let checked = 0;

  for (const file of sources) {
    const source = readFileSync(file, 'utf8');
    for (const ref of collectReferences(file, source)) {
      checked += 1;
      const target = resolve(dirname(file), ref.split('?')[0].split('#')[0]);
      if (!existsSync(target)) {
        missing.push(`${rel(file)} -> ${ref}`);
      }
    }
  }

  assert.ok(checked > 50, `expected to check many asset references, got ${checked}`);
  assert.deepEqual(
    missing,
    [],
    `referenced assets are missing from the repository:\n${missing.join('\n')}`,
  );
});
