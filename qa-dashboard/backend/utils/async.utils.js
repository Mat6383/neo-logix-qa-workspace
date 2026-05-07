/**
 * Wrap a promise with a timeout.
 * Rejects with an Error if the promise doesn't settle within `ms` milliseconds.
 */
function withTimeout(promise, ms, operationName = 'operation') {
  const timeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Timeout after ${ms}ms: ${operationName}`)),
      ms
    )
  );
  return Promise.race([promise, timeout]);
}

module.exports = { withTimeout };
