import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import { createTestApp, loginAs } from './app.factory';

describe('T4 students', () => {
  let app: INestApplication<App>;
  let clerk: TestAgent;
  let sectionId: string;
  const admin = new Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
    max: 1,
  });

  const admit = (
    nameEn: string,
    extra: object = {},
    guardians: object[] = [],
  ) =>
    clerk.post('/api/students/admit').send({
      student: { nameEn, gender: 'm', ...extra },
      guardians,
      sectionId,
      joinedOn: '2026-04-01',
    });

  const counts = async () => {
    const { rows } = await admin.query<Record<string, number>>(
      `select (select count(*)::int from person) as persons,
              (select count(*)::int from guardian_student) as links,
              (select count(*)::int from enrollment) as enrollments`,
    );
    return rows[0];
  };

  beforeAll(async () => {
    app = await createTestApp();
    clerk = await loginAs(app, 'clerk');
    const res = await clerk.get('/api/sections').expect(200);
    sectionId = (res.body as { id: string }[])[0].id;
  });

  afterAll(async () => {
    await admin.end();
    await app.close();
  });

  it('admitting 1 student + 2 guardians creates 3 persons, 2 links, 1 enrollment, audit rows', async () => {
    const before = await counts();
    const res = await admit('Ali Raza', { fatherName: 'Raza Ahmed' }, [
      { nameEn: 'Raza Ahmed', relation: 'father', isPrimary: true },
      { nameEn: 'Sana Raza', relation: 'mother' },
    ]).expect(201);
    expect(await counts()).toEqual({
      persons: before.persons + 3,
      links: before.links + 2,
      enrollments: before.enrollments + 1,
    });

    const { studentId, enrollmentId } = res.body as Record<string, string>;
    const audit = await admin.query<{ action: string }>(
      `select action from audit_log
       where entity_id in ($1, $2) or (action = 'guardian.create' and entity_id in
         (select guardian_id from guardian_student where student_id = $1))`,
      [studentId, enrollmentId],
    );
    expect(audit.rows.map((r) => r.action).sort()).toEqual([
      'enrollment.create',
      'guardian.create',
      'guardian.create',
      'student.admit',
    ]);
  });

  it('search by Arabic-keyboard spelling finds the Urdu-keyboard name', async () => {
    // Stored with Urdu-keyboard letters ک ہ ی
    await admit('Kamran Hashmi', { nameUr: 'کامران ہاشمی' }).expect(201);
    // Typed with Arabic-keyboard letters ك ه ي, plus a stray zabar
    const res = await clerk
      .get('/api/students')
      .query({ q: 'كامرَان هاشمي' })
      .expect(200);
    const body = res.body as { items: { nameEn: string }[]; total: number };
    expect(body.items.map((i) => i.nameEn)).toContain('Kamran Hashmi');
  });

  it('20 parallel admissions get unique admission numbers', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => admit(`Parallel ${i}`)),
    );
    expect(results.map((r) => r.status)).toEqual(Array(20).fill(201));
    const numbers = results.map(
      (r) => (r.body as { admissionNo: string }).admissionNo,
    );
    expect(new Set(numbers).size).toBe(20);
    expect(numbers.every((n) => /^D1-\d{6}$/.test(n))).toBe(true);
  });
});
