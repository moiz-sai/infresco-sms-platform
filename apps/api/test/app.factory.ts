import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

// Seed users share password Admin@123 and PIN 1234 (src/db/seed.ts).
export async function loginAs(app: INestApplication<App>, username: string) {
  const agent = request.agent(app.getHttpServer());
  await agent
    .post('/api/auth/login')
    .send({ username, password: 'Admin@123' })
    .expect(200);
  return agent;
}
