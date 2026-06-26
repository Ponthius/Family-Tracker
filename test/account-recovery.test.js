const test = require('node:test');
const assert = require('node:assert/strict');
const { RECOVERY_WINDOW_DAYS, calculateRecoveryDeadline, isRecoveryExpired, getSuspensionMessage } = require('../account-recovery');

test('recovery deadline is 7 days after deletion time', () => {
  const deletedAt = new Date('2026-06-25T10:00:00.000Z');
  const deadline = calculateRecoveryDeadline(deletedAt);
  assert.equal(deadline.getTime(), deletedAt.getTime() + RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
});

test('expired recovery deadline is detected', () => {
  const deadline = new Date(Date.now() - 1000);
  assert.equal(isRecoveryExpired(deadline), true);
});

test('suspension message explains the recovery flow', () => {
  const message = getSuspensionMessage();
  assert.match(message, /suspended/i);
  assert.match(message, /7 days/i);
  assert.match(message, /recover/i);
});
