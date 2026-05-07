const { withTimeout } = require('../../utils/async.utils');

describe('withTimeout', () => {
  test('resolves when promise completes before timeout', async () => {
    const fast = Promise.resolve(42);
    const result = await withTimeout(fast, 1000, 'test');
    expect(result).toBe(42);
  });

  test('rejects when promise exceeds timeout', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 500));
    await expect(withTimeout(slow, 50, 'slow-op')).rejects.toThrow(
      'Timeout after 50ms: slow-op'
    );
  });

  test('uses default operation name when not provided', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 500));
    await expect(withTimeout(slow, 50)).rejects.toThrow('Timeout after 50ms: operation');
  });
});
