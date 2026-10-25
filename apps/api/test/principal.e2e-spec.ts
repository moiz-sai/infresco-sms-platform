import { INestApplication } from '@nestjs/common';
import type {
  AttendanceSummary,
  AuditItem,
  Dashboard,
  Defaulter,
  Page,
  RoleItem,
  UserItem,
} from '@sms/shared';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import { createTestApp, loginAs } from './app.factory';

const today = () => new Date().toLocaleDateString('en-CA');
const period = () => today().slice(0, 7);
const prevPeriod = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleDateString('en-CA').slice(0, 7);
};

describe('T8 dashboard, users, audit, settings', () => {
  let app: INestApplication<App>;
  let principal: TestAgent;
  let clerk: TestAgent;
  let sectionId: string;
  let enrollmentId: string;
  let initial: Dashboard;
  const tag = randomUUID().slice(0, 6);
  const admin = new Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
    max: 1,
  });

  const dashboard = async () =>
    (await principal.get('/api/dashboard').expect(200)).body as Dashboard;

  beforeAll(async () => {
    app = await createTestApp();
    principal = await loginAs(app, 'principal');
    clerk = await loginAs(app, 'clerk');

    // A section of our own so other suites' rosters are untouched.
    const classes = (await principal.get('/api/classes').expect(200)).body as {
      id: string;
      level: number;
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
        name: `T8${tag}`,
      })
      .expect(201);
    sectionId = (sec.body as { id: string }).id;
    initial = await dashboard();
    const res = await clerk
      .post('/api/students/admit')
      .send({
        student: { nameEn: `Dash Student ${tag}`, gender: 'f' },
        sectionId,
        joinedOn: `${prevPeriod()}-01`,
      })
      .expect(201);
    enrollmentId = (res.body as { enrollmentId: string }).enrollmentId;
  });

  afterAll(async () => {
    await admin.end();
    await app.close();
  });

  it('dashboard reflects charges, payments, attendance and enrollment; payment clears the cache', async () => {
    const before = initial;
    expect(before.date).toBe(today());

    await clerk
      .post('/api/fees/post-charges')
      .send({ period: prevPeriod() })
      .expect(200);
    await clerk
      .post('/api/fees/post-charges')
      .send({ period: period() })
      .expect(200);
    await clerk
      .post(`/api/attendance/sections/${sectionId}/days/${today()}`)
      .send([{ id: randomUUID(), enrollmentId, status: 'A' }])
      .expect(200);

    const mid = await dashboard();
    expect(mid.month.expectedPaisa).toBeGreaterThan(before.month.expectedPaisa);
    expect(mid.absentCount).toBe(before.absentCount + 1);
    expect(mid.enrollment.total).toBe(before.enrollment.total + 1);
    expect(mid.enrollment.girls).toBe(before.enrollment.girls + 1);
    const cls = mid.enrollment.classes.find((c) =>
      c.sections.some((s) => s.sectionId === sectionId),
    )!;
    expect(cls.sections.find((s) => s.sectionId === sectionId)!.total).toBe(1);

    // Cached for 60 s, but a payment must show at once.
    await clerk
      .post('/api/fees/payments')
      .send({ enrollmentId, amountPaisa: 100000, method: 'bank' })
      .expect(201);
    const after = await dashboard();
    const bank = (d: Dashboard) =>
      d.todayCollection.find((c) => c.method === 'bank')?.totalPaisa ?? 0;
    expect(bank(after)).toBe(bank(mid) + 100000);
    expect(after.defaulters.count).toBeGreaterThanOrEqual(1);
  });

  it('defaulters list: owing 2 months, filtered by minMonths', async () => {
    // Demo data may hold hundreds of defaulters, so read every page.
    const all = async (minMonths: number) => {
      const items: Defaulter[] = [];
      for (let page = 1; ; page++) {
        const res = (
          await clerk
            .get('/api/fees/defaulters')
            .query({ minMonths, page, size: 100 })
            .expect(200)
        ).body as Page<Defaulter>;
        items.push(...res.items);
        if (items.length >= res.total || res.items.length === 0) return items;
      }
    };
    const me = (await all(2)).find((d) => d.enrollmentId === enrollmentId)!;
    expect(me.months).toBe(2);
    expect(me.oldestPeriod).toBe(prevPeriod());
    expect((await all(3)).map((d) => d.enrollmentId)).not.toContain(
      enrollmentId,
    );
  });

  it('Z4 attendance summary counts the year', async () => {
    const s = (
      await clerk
        .get(`/api/attendance/enrollments/${enrollmentId}/summary`)
        .expect(200)
    ).body as AttendanceSummary;
    expect(s.counts).toEqual({ P: 0, A: 1, L: 0, V: 0 });
    expect(s.pct).toBe(0);
    expect(s.months).toEqual([
      { month: period(), pct: 0, counts: { P: 0, A: 1, L: 0, V: 0 } },
    ]);
  });

  it('disabling a user logs them out at once', async () => {
    const roles = (await principal.get('/api/roles').expect(200))
      .body as RoleItem[];
    const clerkRole = roles.find((r) => r.code === 'CLERK')!;
    const username = `temp${tag}`;
    const created = await principal
      .post('/api/users')
      .send({
        username,
        nameEn: 'Temp Clerk',
        password: 'Secret#123',
        pin: '4321',
        roleIds: [clerkRole.id],
      })
      .expect(201);
    const userId = (created.body as { id: string }).id;

    const temp = request.agent(app.getHttpServer());
    await temp
      .post('/api/auth/login')
      .send({ username, password: 'Secret#123' })
      .expect(200);
    await temp.get('/api/auth/me').expect(200);

    await principal
      .put(`/api/users/${userId}`)
      .send({ nameEn: 'Temp Clerk', isActive: false })
      .expect(200);
    const { rows } = await admin.query<{ n: number }>(
      `select count(*)::int as n from session where sess->>'userId' = $1`,
      [userId],
    );
    expect(rows[0].n).toBe(0);
    await temp.get('/api/auth/me').expect(401);
    const again = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password: 'Secret#123' })
      .expect(401);
    expect(again.body).toMatchObject({ code: 'ACCOUNT_DISABLED' });

    const list = (await principal.get('/api/users').expect(200))
      .body as UserItem[];
    expect(list.find((u) => u.id === userId)).toMatchObject({
      isActive: false,
      roles: [{ code: 'CLERK' }],
    });
  });

  it('roles, reset and self-protection', async () => {
    const roles = (await principal.get('/api/roles').expect(200))
      .body as RoleItem[];
    const id = (code: string) => roles.find((r) => r.code === code)!.id;
    const username = `role${tag}`;
    const created = await principal
      .post('/api/users')
      .send({
        username,
        nameEn: 'Role Test',
        password: 'Secret#123',
        pin: '4321',
        roleIds: [id('CLERK')],
      })
      .expect(201);
    const userId = (created.body as { id: string }).id;
    await principal
      .post('/api/users')
      .send({
        username,
        nameEn: 'Dup',
        password: 'Secret#123',
        pin: '4321',
        roleIds: [id('CLERK')],
      })
      .expect(409);

    await principal
      .put(`/api/users/${userId}/roles`)
      .send({ roleIds: [id('PRINCIPAL')] })
      .expect(200);
    await principal
      .post(`/api/users/${userId}/reset`)
      .send({ password: 'Changed#456' })
      .expect(200);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ username, password: 'Changed#456' })
      .expect(200);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ roles: ['PRINCIPAL'] });
    // Back to clerk, then the old role can be re-added (soft-deleted grant revived).
    await principal
      .put(`/api/users/${userId}/roles`)
      .send({ roleIds: [id('CLERK')] })
      .expect(200);
    await agent.get('/api/users').expect(403);
    await principal
      .put(`/api/users/${userId}/roles`)
      .send({ roleIds: [id('PRINCIPAL'), id('CLERK')] })
      .expect(200);
    await agent.get('/api/users').expect(200);

    const self = (await principal.get('/api/auth/me').expect(200)).body as {
      id: string;
    };
    await principal
      .put(`/api/users/${self.id}`)
      .send({ nameEn: 'Principal', isActive: false })
      .expect(409);
    await principal
      .put(`/api/users/${self.id}/roles`)
      .send({ roleIds: [id('CLERK')] })
      .expect(409);
    await principal.delete(`/api/users/${userId}`).expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('settings edit is audited and audit search shows a readable line', async () => {
    const settings = (await principal.get('/api/settings').expect(200))
      .body as { attendanceLockDays: number; discountThresholdPaisa: number };
    await principal
      .put('/api/settings')
      .send({
        ...settings,
        attendanceLockDays: settings.attendanceLockDays + 1,
      })
      .expect(200);
    await principal.put('/api/settings').send(settings).expect(200);

    const audit = (
      await principal
        .get('/api/audit')
        .query({ entity: 'school', from: today(), to: today() })
        .expect(200)
    ).body as Page<AuditItem>;
    const line = audit.items.find((a) => a.action === 'settings.update')!;
    expect(line.userName).toBe('Principal');
    expect(line.summary).toContain(
      `lock days ${settings.attendanceLockDays + 1} → ${settings.attendanceLockDays}`,
    );

    const payments = (
      await principal
        .get('/api/audit')
        .query({ entity: 'receipt', size: 5 })
        .expect(200)
    ).body as Page<AuditItem>;
    expect(payments.items[0].summary).toMatch(/^Payment Rs /);
  });

  it('clerk is refused the principal endpoints', async () => {
    for (const path of [
      '/api/users',
      '/api/roles',
      '/api/audit',
      '/api/settings',
    ]) {
      await clerk.get(path).expect(403);
    }
    await clerk.get('/api/dashboard').expect(200);
  });

  it('dashboard < 300 ms with ~300 students, 2 months of fees, 10 days attendance', async () => {
    const { rows: ctx } = await admin.query<{
      school_id: string;
      year_id: string;
      user_id: string;
      tui: string;
    }>(
      `
      select s.school_id, s.year_id,
             (select id from user_account where username = 'principal') as user_id,
             (select id from fee_head where code = 'TUI' and school_id = s.school_id) as tui
      from section s where s.id = $1`,
      [sectionId],
    );
    const { school_id, year_id, user_id, tui } = ctx[0];
    await admin.query(
      `
      with p as (
        insert into person (school_id, kind, name_en, gender, search_text)
        select $1, 'student', 'Load ' || g, case when g % 2 = 0 then 'm' else 'f' end::gender, 'load ' || g
        from generate_series(1, 300) g returning id),
      e as (
        insert into enrollment (school_id, student_id, section_id, year_id, admission_no, joined_on)
        select $1, p.id, $2, $3, 'LOAD-${tag}-' || row_number() over (), current_date - 60 from p
        returning id),
      c as (
        insert into ledger_entry (school_id, enrollment_id, head_id, period, type, amount_paisa, hlc)
        select $1, e.id, $4, per, 'charge', 300000, 1 from e, unnest(array[$5, $6]) per
        returning enrollment_id, period, amount_paisa),
      pay as (
        insert into ledger_entry (school_id, enrollment_id, head_id, period, type, amount_paisa, hlc)
        select $1, enrollment_id, $4, period, 'payment', -amount_paisa, 2 from c
        where abs(hashtext(enrollment_id::text || period)) % 10 < 7)
      insert into attendance_event (school_id, enrollment_id, date, status, marked_by, hlc)
      select $1, e.id, current_date - d, case when d % 7 = 0 then 'A' else 'P' end::attendance_status, $7, 3
      from e, generate_series(0, 9) d`,
      [school_id, sectionId, year_id, tui, prevPeriod(), period(), user_id],
    );
    expect(year_id).toBeTruthy();

    // Write → cache cleared; time the cold build, not a cache hit.
    const settings = (await principal.get('/api/settings').expect(200))
      .body as object;
    await principal.put('/api/settings').send(settings).expect(200);
    const t0 = performance.now();
    const d = await dashboard();
    const ms = performance.now() - t0;
    expect(d.enrollment.total).toBeGreaterThanOrEqual(301);
    expect(d.attendanceTrend.length).toBeGreaterThanOrEqual(10);
    expect(ms).toBeLessThan(300);
  });
});
