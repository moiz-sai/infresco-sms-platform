import { INestApplication } from '@nestjs/common';
import type { AuditItem, Page, PromoteCandidate } from '@sms/shared';
import { randomUUID } from 'node:crypto';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import { createTestApp, loginAs } from './app.factory';

describe('T9 promote page + translatable audit', () => {
  let app: INestApplication<App>;
  let clerk: TestAgent;
  let principal: TestAgent;
  const tag = randomUUID().slice(0, 6);

  beforeAll(async () => {
    app = await createTestApp();
    clerk = await loginAs(app, 'clerk');
    principal = await loginAs(app, 'principal');
  });

  afterAll(() => app.close());

  it('candidates: active students of the section with their balance', async () => {
    const classes = (await principal.get('/api/classes').expect(200)).body as {
      id: string;
    }[];
    const years = (await principal.get('/api/years').expect(200)).body as {
      id: string;
      isCurrent: boolean;
    }[];
    const sec = await principal
      .post('/api/sections')
      .send({
        classId: classes[0].id,
        yearId: years.find((y) => y.isCurrent)!.id,
        name: `P${tag}`,
      })
      .expect(201);
    const sectionId = (sec.body as { id: string }).id;
    const admit = (nameEn: string) =>
      clerk
        .post('/api/students/admit')
        .send({
          student: { nameEn, gender: 'm' },
          sectionId,
          joinedOn: '2026-04-01',
        })
        .expect(201);
    const owing = (await admit(`Owing ${tag}`)).body as {
      enrollmentId: string;
    };
    await admit(`Clear ${tag}`);
    await clerk
      .post('/api/fees/post-charges')
      .send({ period: '2026-04' })
      .expect(200);

    const list = (
      await clerk
        .get('/api/enrollments/promote/candidates')
        .query({ sectionId })
        .expect(200)
    ).body as PromoteCandidate[];
    expect(list.map((c) => c.nameEn).sort()).toEqual(
      [`Clear ${tag}`, `Owing ${tag}`].sort(),
    );
    const o = list.find((c) => c.enrollmentId === owing.enrollmentId)!;
    expect(o.balancePaisa).toBeGreaterThan(0);

    await clerk
      .get('/api/enrollments/promote/candidates')
      .query({ sectionId: 'nope' })
      .expect(400);
  });

  it('audit items carry a template key and params for the UI language', async () => {
    const res = (
      await principal
        .get('/api/audit')
        .query({ entity: 'section', size: 5 })
        .expect(200)
    ).body as Page<AuditItem>;
    const item = res.items[0];
    expect(item.summaryKey).toBe('other');
    expect(item.summaryParams).toMatchObject({ entity: 'section' });
    expect(typeof item.summary).toBe('string');
  });
});
