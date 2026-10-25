import { INestApplication } from '@nestjs/common';
import type { Statement } from '@sms/shared';
import { Pool } from 'pg';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import { createTestApp, loginAs } from './app.factory';

describe('T6 fees', () => {
  let app: INestApplication<App>;
  let clerk: TestAgent;
  let enrollmentId: string;
  const admin = new Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
    max: 1,
  });

  const statement = async () =>
    (
      await clerk
        .get(`/api/fees/students/${enrollmentId}/statement`)
        .expect(200)
    ).body as Statement;
  const postCharges = (period: string) =>
    clerk.post('/api/fees/post-charges').send({ period }).expect(200);

  beforeAll(async () => {
    app = await createTestApp();
    clerk = await loginAs(app, 'clerk');
    const sections = await clerk.get('/api/sections').expect(200);
    const sectionId = (sections.body as { id: string }[])[0].id;
    const res = await clerk
      .post('/api/students/admit')
      .send({
        student: { nameEn: 'Fee Student', gender: 'm' },
        sectionId,
        joinedOn: '2026-04-01',
      })
      .expect(201);
    enrollmentId = (res.body as { enrollmentId: string }).enrollmentId;

    // Waive the yearly exam fee so only tuition (Rs 3,000/month) is charged.
    const heads = await clerk.get('/api/fee-heads').expect(200);
    const exm = (heads.body as { id: string; code: string }[]).find(
      (h) => h.code === 'EXM',
    )!;
    await clerk
      .post('/api/fee-plans')
      .send({ enrollmentId, headId: exm.id, discountType: 'pct', value: 100 })
      .expect(201);
  });

  afterAll(async () => {
    await admin.end();
    await app.close();
  });

  it('post-charges ×3 → charged once', async () => {
    for (let i = 0; i < 3; i++) await postCharges('2026-05');
    const { rows } = await admin.query<{ n: number }>(
      `select count(*)::int as n from ledger_entry
       where enrollment_id = $1 and type = 'charge' and period = '2026-05'`,
      [enrollmentId],
    );
    expect(rows[0].n).toBe(1);
  });

  it('pay Rs 7,000 vs 3 × Rs 3,000 → 2 months cleared, Rs 2,000 due', async () => {
    await postCharges('2026-06');
    await postCharges('2026-07');
    expect((await statement()).balancePaisa).toBe(900_000);

    await clerk
      .post('/api/fees/payments')
      .send({ enrollmentId, amountPaisa: 700_000, method: 'cash' })
      .expect(201);

    const s = await statement();
    expect(s.balancePaisa).toBe(200_000);
    expect(s.dues).toEqual([
      expect.objectContaining({
        period: '2026-07',
        headCode: 'TUI',
        amountPaisa: 200_000,
      }),
    ]);
  });

  it('20 parallel payments → unique receipt numbers', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        clerk
          .post('/api/fees/payments')
          .send({ enrollmentId, amountPaisa: 10_000 }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(20).fill(201));
    const numbers = results.map(
      (r) => (r.body as { receiptNo: string }).receiptNo,
    );
    expect(new Set(numbers).size).toBe(20);
    expect(numbers.every((n) => /^D1-\d{4}-\d{6}$/.test(n))).toBe(true);
    // Rs 2,000 due − 20 × Rs 100 = 0
    expect((await statement()).balancePaisa).toBe(0);
  });
});
