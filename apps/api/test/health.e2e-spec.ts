import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './app.factory';

describe('T1 health', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(() => app.close());

  it('GET /api/health → ok (public, no login)', () =>
    request(app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok' }));
});
