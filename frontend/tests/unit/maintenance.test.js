// Unit tests for the maintenance notice banner: message resolution, the DOM it
// injects and the "off by default" behaviour.
import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isMaintenanceModeEnabled,
  getMessageOverride,
  createBannerElement,
  renderMaintenanceBanner,
  initMaintenanceBanner,
} from '../../src/js/maintenance.js';

const FALLBACK_MESSAGE =
  'Heads-up: we will run brief maintenance soon. Please save your current work.';

/**
 * Minimal DOM double: enough for maintenance.js to inject its banner without
 * pulling in a real DOM implementation.
 */
function createFakeDom() {
  const registry = new Map();
  const cssVars = new Map();

  const createElement = (tagName) => {
    const element = {
      tagName,
      id: '',
      className: '',
      textContent: '',
      children: [],
      attributes: {},
      style: {
        setProperty(name, value) {
          cssVars.set(name, value);
        },
      },
      classList: {
        classes: new Set(),
        add(name) {
          element.classList.classes.add(name);
        },
        contains(name) {
          return element.classList.classes.has(name);
        },
      },
      setAttribute(name, value) {
        element.attributes[name] = value;
      },
      getAttribute(name) {
        return name in element.attributes ? element.attributes[name] : null;
      },
      getBoundingClientRect() {
        return { height: 0 };
      },
      appendChild(child) {
        element.children.push(child);
        if (child.id) registry.set(child.id, child);
        return child;
      },
    };
    return element;
  };

  const head = createElement('head');
  const body = createElement('body');
  const documentElement = createElement('html');

  const doc = {
    head,
    body,
    documentElement,
    createElement,
    getElementById: (id) => registry.get(id) || null,
  };

  const win = {
    TUD_SETTINGS: {},
    addEventListener() {},
  };

  return { doc, win, head, body, cssVars };
}

test('isMaintenanceModeEnabled requires an explicit truthy flag', () => {
  assert.equal(isMaintenanceModeEnabled(undefined), false);
  assert.equal(isMaintenanceModeEnabled(null), false);
  assert.equal(isMaintenanceModeEnabled({}), false);
  assert.equal(isMaintenanceModeEnabled({ IS_MAINTENANCE_MODE: false }), false);
  assert.equal(isMaintenanceModeEnabled({ IS_MAINTENANCE_MODE: true }), true);
});

test('getMessageOverride ignores empty and non-string messages', () => {
  assert.equal(getMessageOverride({}), null);
  assert.equal(getMessageOverride({ MAINTENANCE_MESSAGE: null }), null);
  assert.equal(getMessageOverride({ MAINTENANCE_MESSAGE: '   ' }), null);
  assert.equal(getMessageOverride({ MAINTENANCE_MESSAGE: 42 }), null);
});

test('getMessageOverride trims a configured message', () => {
  assert.equal(
    getMessageOverride({ MAINTENANCE_MESSAGE: '  Back at 14:00  ' }),
    'Back at 14:00'
  );
});

test('banner uses the shared default message and is marked for i18n', () => {
  const { doc } = createFakeDom();
  const banner = createBannerElement(doc, {});

  assert.equal(banner.textContent, FALLBACK_MESSAGE);
  assert.equal(banner.getAttribute('data-i18n'), 'maintenance.banner');
  assert.equal(banner.getAttribute('role'), 'status');
  assert.equal(banner.getAttribute('aria-live'), 'polite');
});

test('an explicit MAINTENANCE_MESSAGE overrides the localised default', () => {
  const { doc } = createFakeDom();
  const banner = createBannerElement(doc, {
    MAINTENANCE_MESSAGE: 'Short maintenance in a few minutes',
  });

  assert.equal(banner.textContent, 'Short maintenance in a few minutes');
  assert.equal(banner.getAttribute('data-i18n'), null);
});

test('nothing is injected while maintenance mode is off', () => {
  const { doc, win, body, head } = createFakeDom();

  assert.equal(renderMaintenanceBanner(doc, win, {}), null);
  assert.equal(body.children.length, 0);
  assert.equal(head.children.length, 0);
  assert.equal(body.classList.contains('tud-maintenance-active'), false);
});

test('enabled maintenance mode injects styles, banner and height variable', () => {
  const { doc, win, body, head, cssVars } = createFakeDom();

  const banner = renderMaintenanceBanner(doc, win, {
    IS_MAINTENANCE_MODE: true,
  });

  assert.ok(banner);
  assert.equal(banner.textContent, FALLBACK_MESSAGE);
  assert.equal(body.children.length, 1);
  assert.equal(body.classList.contains('tud-maintenance-active'), true);
  assert.equal(head.children.length, 1, 'stylesheet should be injected once');
  assert.equal(cssVars.get('--tud-maintenance-banner-height'), '0px');
});

test('repeated rendering does not add the banner twice', () => {
  const { doc, win, body, head } = createFakeDom();
  const settings = { IS_MAINTENANCE_MODE: true };

  renderMaintenanceBanner(doc, win, settings);
  assert.equal(renderMaintenanceBanner(doc, win, settings), null);
  assert.equal(body.children.length, 1);
  assert.equal(head.children.length, 1);
});

test('initMaintenanceBanner is a no-op without the deployment flag', () => {
  // The test setup provides a TUD_SETTINGS shim without IS_MAINTENANCE_MODE,
  // which is exactly what a deployment with maintenance mode off looks like.
  assert.equal(initMaintenanceBanner(), null);
});
