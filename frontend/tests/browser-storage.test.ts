import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearObsoleteBrowserStorage } from '../src/utils/browserStorage.ts';
import { saveApplication, savedApplication, forgetApplication } from '../src/utils/partnerApplication.ts';

test('migration removes only project-owned obsolete keys and preserves harmless preferences', () => {
  const local = new Map<string, string>([
    ['app_cart', 'private-cart'], ['greenfarm.content', 'stale-settings'],
    ['greenfarm_partner_application_email', 'applicant@example.com'], ['greenfarm_partner_application', 'private-code'],
    ['greenfarm_admin_low_stock', '15'], ['greenfarm.driver.sidebar', 'collapsed'], ['another-app.preference', 'keep'],
  ]);
  const session = new Map<string, string>([
    ['greenfarm_partner_application_reference', 'private-code'], ['greenfarm.session.customer', 'private-session'],
    ['greenfarm.session.admin', 'private-session'], ['greenfarm.session.partner', 'private-session'], ['banner_dismissed', 'Public announcement'],
  ]);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { removeItem: (key: string) => local.delete(key) },
    sessionStorage: { removeItem: (key: string) => session.delete(key) },
  } });
  clearObsoleteBrowserStorage();
  clearObsoleteBrowserStorage();
  assert.deepEqual([...local.keys()].sort(), ['another-app.preference', 'greenfarm.driver.sidebar', 'greenfarm_admin_low_stock'].sort());
  assert.deepEqual([...session.keys()], ['banner_dismissed']);
});

test('cleanup tolerates blocked local storage and still cleans accessible session storage', () => {
  const removed: string[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    get localStorage() { throw new Error('Storage blocked'); },
    sessionStorage: { removeItem: (key: string) => removed.push(key) },
  } });
  assert.doesNotThrow(clearObsoleteBrowserStorage);
  assert.ok(removed.includes('greenfarm_partner_application_reference'));
});

test('application details survive client-side navigation only in memory, without touching browser storage', () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    get localStorage() { throw new Error('Must not use browser storage'); },
    get sessionStorage() { throw new Error('Must not use browser storage'); },
  } });
  forgetApplication();
  assert.equal(savedApplication(), null);
  const input = { email: 'applicant@example.com', reference: 'GF-TEST-CODE' };
  saveApplication(input);
  input.reference = 'tampered';
  assert.equal(savedApplication()!.reference, 'GF-TEST-CODE');
  const copy = savedApplication()!;
  copy.email = 'changed@example.com';
  assert.equal(savedApplication()!.email, 'applicant@example.com');
  forgetApplication();
  assert.equal(savedApplication(), null);
});
