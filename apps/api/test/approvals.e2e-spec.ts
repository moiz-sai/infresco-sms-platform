import { INestApplication } from '@nestjs/common';
import type { ApprovalOutcome, PromoteResult, Statement } from '@sms/shared';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import { createTestApp, loginAs } from './app.factory';

describe('T7 discounts, approvals, reversal, cash close', () => {
  let app: INestApplication<App>;
  let clerk: TestAgent;
  let principal: TestAgent;
  let sections: { id: string }[];
  let heads: { id: string; code: string }[];

  const admit = async (nameEn: string, sectionId = sections[0].id) => {
    const res = await clerk
      .post('/api/students/admit')
      .send({
        student: { nameEn, gender: 'm' },
        sectionId,
        joinedOn: '2026-04-01',
      })
      .expect(201);
    return res.body as { enrollmentId: string; studentId: string };
  };
  const statement = async (enrollmentId: string) =>
    (
      await clerk
        .get(`/api/fees/students/${enrollmentId}/statement`)
        .expect(200)
    ).body as Statement;
  const head = (code: string) => heads.find((h) => h.code === code)!.id;

  beforeAll(async () => {
    app = await createTestApp();
    clerk = await loginAs(app, 'clerk');
    principal = await loginAs(app, 'principal');
    sections = (await clerk.get('/api/sections').expect(200)).body as {
      id: string;
    }[];
    heads = (await clerk.get('/api/fee-heads').expect(200))
      .body as typeof heads;
  });

  afterAll(() => app.close());

  it('Blueprint §6.2: +3,500 → −3,000 → waiver −500 → reversal +3,000 → balance 3,000; second reversal fails', async () => {
    const { enrollmentId } = await admit('Scenario Student');
    await clerk
      .post('/api/fees/post-charges')
      .send({ period: '2026-08' })
      .expect(200);
    expect((await statement(enrollmentId)).balancePaisa).toBe(350_000);

    const paid = await clerk
      .post('/api/fees/payments')
      .send({ enrollmentId, amountPaisa: 300_000, method: 'cash' })
      .expect(201);
    const { receiptId } = paid.body as { receiptId: string };

    // Rs 500 ≤ threshold → applied directly, even for the clerk
    const waiver = await clerk
      .post('/api/fees/discounts')
      .send({
        enrollmentId,
        headId: head('EXM'),
        period: '2026-08',
        amountPaisa: 50_000,
        reason: 'Waiver',
      })
      .expect(201);
    expect((waiver.body as ApprovalOutcome).applied).toBe(true);

    // Clerk's reversal always needs the principal
    const req = await clerk
      .post(`/api/fees/receipts/${receiptId}/reverse`)
      .send({ reason: 'Wrong student' })
      .expect(200);
    const { pendingApprovalId } = req.body as ApprovalOutcome;
    expect(pendingApprovalId).toBeDefined();
    expect((await statement(enrollmentId)).balancePaisa).toBe(0);
    await principal
      .post(`/api/approvals/${pendingApprovalId}/approve`)
      .expect(200);

    const s = await statement(enrollmentId);
    expect(s.entries.map((e) => [e.type, e.amountPaisa])).toEqual([
      ['charge', expect.any(Number)],
      ['charge', expect.any(Number)],
      ['payment', -300_000],
      ['adjust', -50_000],
      ['reversal', 300_000],
    ]);
    expect(
      s.entries.slice(0, 2).reduce((sum, e) => sum + e.amountPaisa, 0),
    ).toBe(350_000);
    expect(s.balancePaisa).toBe(300_000);

    const receipt = await clerk
      .get(`/api/fees/receipts/${receiptId}`)
      .expect(200);
    expect((receipt.body as { cancelled: boolean }).cancelled).toBe(true);

    // Second reversal of the same payment fails (direct or via request)
    await principal
      .post(`/api/fees/receipts/${receiptId}/reverse`)
      .send({ reason: 'again' })
      .expect(409);
    await clerk
      .post(`/api/fees/receipts/${receiptId}/reverse`)
      .send({ reason: 'again' })
      .expect(409);
    await principal
      .post(`/api/approvals/${pendingApprovalId}/approve`)
      .expect(409);
  });

  it('second close of the same date fails', async () => {
    // A past date unique to this run, so re-runs without a DB reset still start unclosed.
    const d = new Date(2000, 0, 1 + Math.floor(Math.random() * 9000));
    const date = d.toLocaleDateString('en-CA');
    await clerk
      .post(`/api/fees/cash-close/${date}`)
      .send({ countedTotalPaisa: 0 })
      .expect(201);
    await clerk
      .post(`/api/fees/cash-close/${date}`)
      .send({ countedTotalPaisa: 0 })
      .expect(409);
  });

  it('§Z1: principal discount above threshold applies directly; clerk discount goes to approval', async () => {
    const { enrollmentId } = await admit('Threshold Student');
    await clerk
      .post('/api/fees/post-charges')
      .send({ period: '2026-08' })
      .expect(200);
    const discount = (amountPaisa: number) => ({
      enrollmentId,
      headId: head('TUI'),
      period: '2026-08',
      amountPaisa,
      reason: 'Hardship',
    });

    // Rs 2,000 > Rs 1,000 threshold: the clerk's request waits; nothing changes yet
    const byClerk = await clerk
      .post('/api/fees/discounts')
      .send(discount(200_000))
      .expect(201);
    expect((byClerk.body as ApprovalOutcome).applied).toBe(false);
    expect((await statement(enrollmentId)).balancePaisa).toBe(350_000);

    // Principal's Rs 1,500 applies at once (§Z1)
    const byPrincipal = await principal
      .post('/api/fees/discounts')
      .send(discount(150_000))
      .expect(201);
    expect((byPrincipal.body as ApprovalOutcome).applied).toBe(true);
    expect((await statement(enrollmentId)).balancePaisa).toBe(200_000);

    // Only Rs 1,500 tuition is left, so the Rs 2,000 request is stale: approval re-validates and refuses
    const pending = (byClerk.body as ApprovalOutcome).pendingApprovalId!;
    await principal.post(`/api/approvals/${pending}/approve`).expect(409);
    expect((await statement(enrollmentId)).balancePaisa).toBe(200_000);
  });

  it('§Z6: clerk promotion — paid student moves, owing student waits for approval; dues carry forward', async () => {
    const owing = await admit('Owing Student');
    const paid = await admit('Paid Student');
    await clerk
      .post('/api/fees/post-charges')
      .send({ period: '2026-09' })
      .expect(200);
    const due = (await statement(paid.enrollmentId)).balancePaisa;
    await clerk
      .post('/api/fees/payments')
      .send({
        enrollmentId: paid.enrollmentId,
        amountPaisa: due,
        method: 'bank',
      })
      .expect(201);

    const res = await clerk
      .post('/api/enrollments/promote')
      .send({
        fromSectionId: sections[0].id,
        toSectionId: sections[1].id,
        studentIds: [owing.studentId, paid.studentId],
      })
      .expect(200);
    const result = res.body as PromoteResult;
    expect(result).toMatchObject({ promoted: 1, pendingCount: 1 });

    const owedBefore = (await statement(owing.enrollmentId)).balancePaisa;
    await principal
      .post(`/api/approvals/${result.pendingApprovalId}/approve`)
      .expect(200);

    const old = await statement(owing.enrollmentId);
    expect(old.balancePaisa).toBe(0);
    const profile = await clerk
      .get(`/api/students/${owing.studentId}`)
      .expect(200);
    const newEnrollment = (
      profile.body as { enrollments: { id: string; status: string }[] }
    ).enrollments.find((e) => e.status === 'active')!;
    const moved = await statement(newEnrollment.id);
    expect(moved.balancePaisa).toBe(owedBefore);
    expect(moved.dues.map((d) => d.period)).toContain('2026-09');
  });

  it('§Z3: guardian search finds an existing guardian; linking makes the students siblings', async () => {
    const tag = Math.random().toString(36).slice(2, 8);
    const first = await clerk
      .post('/api/students/admit')
      .send({
        student: { nameEn: 'Elder Sibling', gender: 'm' },
        guardians: [
          {
            nameEn: `Shared Parent ${tag}`,
            phone: '0300-5550001',
            relation: 'father',
          },
        ],
        sectionId: sections[0].id,
        joinedOn: '2026-04-01',
      })
      .expect(201);
    const found = await clerk
      .get('/api/guardians')
      .query({ q: `parent ${tag}` })
      .expect(200);
    const guardian = (found.body as { id: string; children: string[] }[])[0];
    expect(guardian.children).toContain('Elder Sibling');

    const second = await clerk
      .post('/api/students/admit')
      .send({
        student: { nameEn: 'Younger Sibling', gender: 'f' },
        guardians: [{ guardianId: guardian.id, relation: 'father' }],
        sectionId: sections[0].id,
        joinedOn: '2026-04-01',
      })
      .expect(201);
    const s = await statement(
      (second.body as { enrollmentId: string }).enrollmentId,
    );
    expect(s.siblings.map((x) => x.enrollmentId)).toEqual([
      (first.body as { enrollmentId: string }).enrollmentId,
    ]);
  });
});
