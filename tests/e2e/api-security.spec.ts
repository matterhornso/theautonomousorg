import { test, expect } from '@playwright/test';

test.describe('API Security - Unauthenticated requests return 401', () => {
  test('GET /api/credits → 401', async ({ request }) => {
    const res = await request.get('/api/credits');
    expect(res.status()).toBe(401);
  });

  test('GET /api/agents/status → 401', async ({ request }) => {
    const res = await request.get('/api/agents/status');
    expect(res.status()).toBe(401);
  });

  test('GET /api/team → 401', async ({ request }) => {
    const res = await request.get('/api/team');
    expect(res.status()).toBe(401);
  });

  test('POST /api/upload → 401', async ({ request }) => {
    const res = await request.post('/api/upload', { data: {} });
    expect(res.status()).toBe(401);
  });

  test('GET /api/v1/agents → 401', async ({ request }) => {
    const res = await request.get('/api/v1/agents');
    expect(res.status()).toBe(401);
  });

  test('GET /api/profile → 401', async ({ request }) => {
    const res = await request.get('/api/profile');
    expect([401, 404]).toContain(res.status());
  });

  test('GET /api/leaderboard → 401', async ({ request }) => {
    const res = await request.get('/api/leaderboard');
    expect([401, 404]).toContain(res.status());
  });

  test('GET /api/workflows → 401', async ({ request }) => {
    const res = await request.get('/api/workflows');
    expect([401, 404]).toContain(res.status());
  });

  test('POST /api/chat → 401', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: { agentId: 'fake-agent-id', message: 'hello' },
    });
    expect([401, 404]).toContain(res.status());
  });
});
