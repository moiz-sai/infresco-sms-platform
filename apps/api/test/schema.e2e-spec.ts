import { CLERK_DEFAULT_EXCLUDED, PERMISSION_CODES } from '@sms/shared';
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
      permission: PERMISSION_CODES.length,
      school: 1,
      class: 5,
      fee_head: 3,
      fee_structure: 10,
    });
    // Custom roles from other suites are not the seed's: count built-in roles only.
    const builtIn = await admin.query<{ roles: number; grants: number }>(
      `select count(distinct r.id)::int as roles, count(rp.*)::int as grants
         from role r left join role_permission rp on rp.role_id = r.id
        where r.school_id is null`,
    );
    expect(builtIn.rows[0]).toEqual({
      roles: 2,
      grants: PERMISSION_CODES.length * 2 - CLERK_DEFAULT_EXCLUDED.length,
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
        (select count(*)::int from section s join academic_year y on y.id = s.year_id
          where y.is_current and s.name in ('A', 'B')) as sections`);
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
