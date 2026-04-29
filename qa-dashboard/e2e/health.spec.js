import { test, expect } from '@playwright/test';

test.describe('Backend health', () => {
  test('health endpoint returns OK status', async ({ request }) => {
    const resp = await request.get('http://localhost:3001/api/health');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe('OK');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('timestamp');
  });

  test('projects endpoint is reachable', async ({ request }) => {
    const resp = await request.get('http://localhost:3001/api/projects');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('success');
  });
});
