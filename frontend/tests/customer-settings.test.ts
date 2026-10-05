import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoError, PHOTO_MAX_BYTES, profileErrors, passwordErrors } from '../src/utils/customerSettings.ts';
test('photo selection rejects unsupported, empty and oversized images while allowing the 5 MB boundary', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(photoError({ type, size: PHOTO_MAX_BYTES }), '');
  assert.match(photoError({ type: 'image/svg+xml', size: 100 }), /JPG/);
  assert.match(photoError({ type: 'image/png', size: PHOTO_MAX_BYTES + 1 }), /5 MB/);
  assert.match(photoError({ type: 'image/png', size: 0 }), /empty/);
});
test('profile validation permits an optional phone and rejects names and phone formats invalid on the server', () => {
  assert.deepEqual(profileErrors('Alice', ''), { fullName: '', phone: '' });
  assert.equal(profileErrors('Alice', '+233 24 123 4567').phone, '');
  assert.ok(profileErrors(' ', '').fullName); assert.ok(profileErrors('a'.repeat(101), '').fullName);
  assert.ok(profileErrors('Alice', 'abc').phone); assert.ok(profileErrors('Alice', '1234').phone);
});
test('password validation matches confirmation, rejects reused passwords and respects bcrypt UTF-8 byte limits', () => {
  assert.deepEqual(passwordErrors('Old-password', 'New-password', 'New-password'), { current: '', next: '', confirm: '' });
  assert.ok(passwordErrors('Old-password', 'short', 'different').next);
  assert.ok(passwordErrors('Old-password', 'New-password', 'different').confirm);
  assert.ok(passwordErrors('Old-password', 'Old-password', 'Old-password').next);
  assert.ok(passwordErrors('Old-password', 'é'.repeat(37), 'é'.repeat(37)).next);
  assert.equal(passwordErrors('Old-password', 'é'.repeat(36), 'é'.repeat(36)).next, '');
});
