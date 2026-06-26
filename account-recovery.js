const RECOVERY_WINDOW_DAYS = 7;

function calculateRecoveryDeadline(deletedAt) {
  const date = new Date(deletedAt);
  date.setDate(date.getDate() + RECOVERY_WINDOW_DAYS);
  return date;
}

function isRecoveryExpired(recoveryDeadline) {
  return new Date(recoveryDeadline).getTime() <= Date.now();
}

function getSuspensionMessage() {
  return 'This account has been suspended and is scheduled for permanent deletion. Would you like to recover your account and data?';
}

module.exports = {
  RECOVERY_WINDOW_DAYS,
  calculateRecoveryDeadline,
  isRecoveryExpired,
  getSuspensionMessage
};
