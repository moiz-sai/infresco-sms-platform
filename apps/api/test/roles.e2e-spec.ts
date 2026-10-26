import { INestApplication } from '@nestjs/common';
import type { Me, RoleItem } from '@sms/shared';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import * as schema from '../src/db/schema';
import { seed } from '../src/db/seed';
import { createTestApp, loginAs } from './app.factory';

describe('T12 roles editor', () => {
  let app: INestApplication<App>;
  let principal: TestAgent;
  let clerk: TestAgent;
  let clerkRole: RoleItem;
  const tag = randomUUID().slice(0, 6);
  const admin = new Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
    max: 1,
  });
  const runSeed = () =>
    seed(drizzle({ client: admin, schema, casing: 'snake_case' }));

  const roles = async () =>
    (await principal.get('/api/roles').expect(200)).body as RoleItem[];
  const me = async (agent: TestAgent) =>
    (await agent.get('/api/auth/me').expect(200)).body as Me;
  const putClerk = (permissions: string[]) =>
    principal.put(`/api/roles/${clerkRole.id}`).send({
      nameEn: clerkRole.nameEn,
      nameUr: clerkRole.nameUr,
      permissions,
    });

  beforeAll(async () => {
    app = await createTestApp();
    principal = await loginAs(app, 'principal');
    clerk = await loginAs(app, 'clerk');
    clerkRole = (await roles()).find((r) => r.code === 'CLERK')!;
  });

  afterAll(async () => {
    await putClerk(clerkRole.permissions).expect(200);
    await admin.end();
    await app.close();
  });

  it('lists roles with the principal locked', async () => {
    const list = await roles();
    const p = list.find((r) => r.code === 'PRINCIPAL')!;
    expect(p.locked).toBe(true);
    expect(p.permissions).toContain('roles.manage');
    expect(clerkRole.locked).toBe(false);
    expect(clerkRole.permissions).toContain('fees.collect');
    expect(clerkRole.permissions).not.toContain('roles.manage');
  });

  it('hiding a module from the clerk applies at once and survives the seed', async () => {
    await clerk.get('/api/fees/defaulters').expect(200);
    await putClerk(
      clerkRole.permissions.filter((c) => !c.startsWith('fees.')),
    ).expect(200);

    // Same session, no re-login: refused at once and gone from /auth/me.
    await clerk.get('/api/fees/defaulters').expect(403);
    await clerk
      .post('/api/fees/payments')
      .send({ enrollmentId: randomUUID(), amountPaisa: 100, method: 'cash' })
      .expect(403);
    expect((await me(clerk)).permissions).not.toContain('fees.collect');

    await runSeed();
    await clerk.get('/api/fees/defaulters').expect(403);

    const audit = await admin.query<{ before: unknown; after: unknown }>(
      `select before, after from audit_log where action = 'role.permissions' and entity_id = $1 order by created_at desc limit 1`,
      [clerkRole.id],
    );
    expect(audit.rows[0].before).toMatchObject({
      permissions: expect.arrayContaining(['fees.collect']) as unknown,
    });
  });

  it('a permission new to the database reaches the clerk on the next seed', async () => {
    await putClerk(clerkRole.permissions).expect(200);
    // Simulate an upgrade that introduces fees.cash_close.
    await admin.query(
      `delete from role_permission where permission_code = 'fees.cash_close'`,
    );
    await admin.query(`delete from permission where code = 'fees.cash_close'`);
    expect((await me(clerk)).permissions).not.toContain('fees.cash_close');
    await runSeed();
    expect((await me(clerk)).permissions).toContain('fees.cash_close');
    expect((await me(principal)).permissions).toContain('fees.cash_close');
  });

  it('refuses to edit the principal role or grant principal-only codes', async () => {
    const p = (await roles()).find((r) => r.code === 'PRINCIPAL')!;
    await principal
      .put(`/api/roles/${p.id}`)
      .send({ nameEn: 'Principal', permissions: [] })
      .expect(400);
    const res = await putClerk([...clerkRole.permissions, 'roles.manage']);
    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('PRINCIPAL_ONLY');
    await putClerk(['no.such.permission']).expect(400);
    // The clerk cannot edit roles at all.
    await clerk
      .put(`/api/roles/${clerkRole.id}`)
      .send({ nameEn: 'Clerk', permissions: [] })
      .expect(403);
  });

  it('custom roles: create, assign, delete only when unused', async () => {
    const created = await principal
      .post('/api/roles')
      .send({ nameEn: `Gatekeeper ${tag}`, permissions: ['attendance.mark'] })
      .expect(201);
    const roleId = (created.body as { id: string }).id;
    const user = await principal
      .post('/api/users')
      .send({
        username: `gate${tag}`,
        nameEn: `Gate ${tag}`,
        password: 'Admin@123',
        pin: '1234',
        roleIds: [roleId],
      })
      .expect(201);
    const role = (await roles()).find((r) => r.id === roleId)!;
    expect(role.builtIn).toBe(false);
    expect(role.userCount).toBe(1);
    await principal.delete(`/api/roles/${roleId}`).expect(409);

    const gate = await loginAs(app, `gate${tag}`);
    expect((await me(gate)).permissions).toEqual(['attendance.mark']);
    await gate.get('/api/students').expect(403);

    await principal
      .delete(`/api/users/${(user.body as { id: string }).id}`)
      .expect(204);
    await principal.delete(`/api/roles/${roleId}`).expect(204);
    expect((await roles()).some((r) => r.id === roleId)).toBe(false);
  });
});
