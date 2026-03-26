import { test, expect } from '@playwright/test';

test.describe('Input Validation', () => {
  test('POST /api/analyze with empty URL → 400', async ({ request }) => {
    const res = await request.post('/api/analyze', {
      data: { url: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/analyze with missing URL field → 400', async ({ request }) => {
    const res = await request.post('/api/analyze', {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/analyze with invalid URL → 400', async ({ request }) => {
    const res = await request.post('/api/analyze', {
      data: { url: 'not-a-valid-url-!!!###' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/analyze with private IP → 400', async ({ request }) => {
    const res = await request.post('/api/analyze', {
      data: { url: 'http://192.168.1.1' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/analyze with localhost → 400', async ({ request }) => {
    const res = await request.post('/api/analyze', {
      data: { url: 'http://localhost:8080/admin' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/chat with fake agentId → 404 or 401', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: { agentId: 'fake-nonexistent-agent-id-xyz', message: 'hello' },
    });
    expect([401, 404]).toContain(res.status());
  });
});
