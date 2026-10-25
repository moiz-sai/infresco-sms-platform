import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import { createTestApp, loginAs } from './app.factory';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
};

describe('T5 attendance', () => {
  let app: INestApplication<App>;
  let clerk: TestAgent;
  let sectionId: string;
  let enrollments: string[];
  const admin = new Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
    max: 1,
  });

  const events = async (date: string, ids = enrollments) => {
    const { rows } = await admin.query<{ n: number }>(
      'select count(*)::int as n from attendance_event where date = $1 and enrollment_id = any($2)',
      [date, ids],
    );
    return rows[0].n;
  };
  const save = (date: string, body: object[]) =>
    clerk.post(`/api/attendance/sections/${sectionId}/days/${date}`).send(body);

  beforeAll(async () => {
    app = await createTestApp();
    clerk = await loginAs(app, 'clerk');
    const sections = await clerk.get('/api/sections').expect(200);
    sectionId = (sections.body as { id: string }[])[0].id;
    enrollments = [];
    for (const name of ['Att One', 'Att Two']) {
      const res = await clerk
        .post('/api/students/admit')
        .send({
          student: { nameEn: name, gender: 'f' },
          sectionId,
          joinedOn: daysAgo(30),
        })
        .expect(201);
      enrollments.push((res.body as { enrollmentId: string }).enrollmentId);
    }
  });

  afterAll(async () => {
    await admin.end();
    await app.close();
  });

  it('same POST ×3 → events once', async () => {
    const date = daysAgo(0);
    const body = enrollments.map((enrollmentId, i) => ({
      id: randomUUID(),
      enrollmentId,
      status: i === 0 ? 'P' : 'A',
    }));
    for (let i = 0; i < 3; i++) await save(date, body).expect(200);
    expect(await events(date)).toBe(2);
  });

  it('P then A → view shows A, both rows kept', async () => {
    const date = daysAgo(1);
    const [enrollmentId] = enrollments;
    await save(date, [{ id: randomUUID(), enrollmentId, status: 'P' }]).expect(
      200,
    );
    await save(date, [{ id: randomUUID(), enrollmentId, status: 'A' }]).expect(
      200,
    );

    const day = await clerk
      .get(`/api/attendance/sections/${sectionId}/days/${date}`)
      .expect(200);
    const row = (
      day.body as { rows: { enrollmentId: string; status: string }[] }
    ).rows.find((r) => r.enrollmentId === enrollmentId);
    expect(row?.status).toBe('A');
    expect(await events(date, [enrollmentId])).toBe(2);
  });

  it('5-day-old edit → pending approval', async () => {
    const date = daysAgo(5);
    const res = await save(date, [
      { id: randomUUID(), enrollmentId: enrollments[0], status: 'A' },
    ]).expect(200);
    const { pendingApprovalId } = res.body as { pendingApprovalId?: string };
    expect(pendingApprovalId).toBeDefined();

    const { rows } = await admin.query<{ action: string; status: string }>(
      'select action, status from approval_request where id = $1',
      [pendingApprovalId],
    );
    expect(rows[0]).toEqual({
      action: 'attendance.edit_old',
      status: 'pending',
    });
    expect(await events(date)).toBe(0);
  });
});
