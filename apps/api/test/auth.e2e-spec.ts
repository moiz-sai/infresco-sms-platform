import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { createTestApp, loginAs } from './app.factory';

describe('T3 auth and RBAC', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(() => app.close());

  it('clerk → 403 on /api/approvals', async () => {
    const clerk = await loginAs(app, 'clerk');
    const res = await clerk.get('/api/approvals').expect(403);
    expect(res.body).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('principal → 200 on /api/approvals', async () => {
    const principal = await loginAs(app, 'principal');
    const res = await principal.get('/api/approvals').expect(200);
    // Other suites may have created requests; only the list shape is T3's concern.
    expect(res.body).toEqual({
      items: expect.any(Array) as unknown,
      total: expect.any(Number) as unknown,
    });
  });

  it('logout → /auth/me 401', async () => {
    const clerk = await loginAs(app, 'clerk');
    await clerk.get('/api/auth/me').expect(200);
    await clerk.post('/api/auth/logout').expect(204);
    await clerk.get('/api/auth/me').expect(401);
  });

  it('PIN switch changes /auth/me', async () => {
    const agent = await loginAs(app, 'clerk');
    const before = await agent.get('/api/auth/me').expect(200);
    expect(before.body).toMatchObject({ username: 'clerk', roles: ['CLERK'] });
    await agent
      .post('/api/auth/switch')
      .send({ username: 'principal', pin: '1234' })
      .expect(200);
    const after = await agent.get('/api/auth/me').expect(200);
    expect(after.body).toMatchObject({
      username: 'principal',
      roles: ['PRINCIPAL'],
    });
  });
});
