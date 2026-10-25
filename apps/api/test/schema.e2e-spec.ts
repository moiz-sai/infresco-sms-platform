import { drizzle } from 'drizzle-orm/node-postgres';
import { DatabaseError, Pool } from 'pg';
import * as schema from '../src/db/schema';
import { seed } from '../src/db/seed';

const TABLES = [
  'permission',
  'role',
  'role_permission',
  'school',
  'device',
  'counter',
  'academic_year',
  'class',
  'section',
  'fee_head',
  'fee_structure',
  'person',
  'user_account',
  'user_role',
];

describe('T2 schema and seed', () => {
  const admin = new Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
    max: 1,
  });
  const app = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

  afterAll(async () => {
    await admin.end();
    await app.end();
  });

  async function counts() {
    const out: Record<string, number> = {};
    for (const t of TABLES) {
      const { rows } = await admin.query<{ n: number }>(
        `select count(*)::int as n from "${t}"`,
      );
      out[t] = rows[0].n;
    }
    return out;
  }

  it('seed is idempotent and creates the demo data', async () => {
    const db = drizzle({ client: admin, schema, casing: 'snake_case' });
    await seed(db);
    const before = await counts();
    await seed(db);
    expect(await counts()).toEqual(before);
    expect(before).toMatchObject({
      permission: 13,
      role: 2,
      role_permission: 22,
      school: 1,
      class: 5,
      fee_head: 3,
      fee_structure: 10,
    });
    // Other suites add users and sections, so count only the seed's own rows.
    const { rows } = await admin.query<{
      users: number;
      grants: number;
      sections: number;
    }>(`
      select
        (select count(*)::int from user_account where username in ('principal', 'clerk')) as users,
        (select count(*)::int from user_role r join user_account u on u.id = r.user_id
          where u.username in ('principal', 'clerk') and r.deleted_at is null) as grants,
        (select count(*)::int from section where name in ('A', 'B')) as sections`);
    expect(rows[0]).toEqual({ users: 2, grants: 2, sections: 10 });
  });

  it.each(schema.APPEND_ONLY_TABLES)(
    'sms_app cannot UPDATE or DELETE %s',
    async (t) => {
      for (const sql of [
        `update "${t}" set created_at = now()`,
        `delete from "${t}"`,
      ]) {
        await expect(app.query(sql)).rejects.toMatchObject({
          code: '42501',
        } satisfies Partial<DatabaseError>);
      }
    },
  );

  it('sms_app can write mutable tables and read the attendance view', async () => {
    await expect(
      app.query(`update person set name_en = name_en where false`),
    ).resolves.toBeDefined();
    await expect(
      app.query(`select * from attendance_effective limit 1`),
    ).resolves.toBeDefined();
  });
});
