import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword, DUMMY_HASH } from './password.js';
import { readSessionCookie } from './cookie.js';
import { username } from './accounts.js';

test('bounded scrypt uses random salt and rejects wrong, malformed, and oversized input', async () => {
  const password = randomBytes(24).toString('base64url'), first = await hashPassword(password), second = await hashPassword(password);
  assert(first !== second); assert(!first.includes(password));
  assert(await verifyPassword(password, first)); assert(!(await verifyPassword(`${password}wrong`, first)));
  assert(!(await verifyPassword(password, 'broken'))); assert(!(await verifyPassword(password, `${first}$extra`)));
  assert(!(await verifyPassword(undefined, first))); assert(!(await verifyPassword('界'.repeat(86), first)));
  assert(!(await verifyPassword(password, DUMMY_HASH)));
  await assert.rejects(hashPassword('short')); await assert.rejects(hashPassword('界'.repeat(86)));
});

test('username and cookie parsing reject ambiguity and excessive headers', () => {
  assert.equal(username(' OPERATOR-ONE '), 'operator-one'); assert.equal(username('x'), null); assert.equal(username('界'.repeat(4)), null);
  assert.equal(username('a'.repeat(65)), null); assert.equal(username('person@example.com'), null);
  const token = randomBytes(32).toString('base64url'), cookie = `shipkit_session=${token}`;
  assert.equal(readSessionCookie(`unrelated=value; ${cookie}`), token);
  assert.equal(readSessionCookie(`${cookie}; ${cookie}`), null); assert.equal(readSessionCookie('shipkit_session=short'), null);
  assert.equal(readSessionCookie(`${'x'.repeat(8200)}; ${cookie}`), null); assert.equal(readSessionCookie(undefined), null);
});
