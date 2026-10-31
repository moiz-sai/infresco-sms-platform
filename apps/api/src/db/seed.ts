import { hash } from '@node-rs/argon2';
import {
  CLERK_DEFAULT_EXCLUDED,
  PERMISSION_CODES,
  PERMISSION_MODULES,
} from '@sms/shared';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Db } from './database.module';
import * as s from './schema';
import { loadScriptEnv } from './script-env';

export const DEMO_SCHOOL_ID = '019a0000-0000-7000-8000-000000000001';
// The Windows installer sets private first-login values; development keeps the demo ones.
const DEMO_PASSWORD = process.env.SMS_INITIAL_PASSWORD || 'Admin@123';
const DEMO_PIN = process.env.SMS_INITIAL_PIN || '1234';
const URDU_DIGITS = ['۱', '۲', '۳', '۴', '۵'];

export async function seed(db: Db) {
  const passwordHash = await hash(DEMO_PASSWORD);
  const pinHash = await hash(DEMO_PIN);

  await db.transaction(async (tx) => {
    // module is refreshed on every run; `inserted` is true only for codes new to this database.
    const perms = await tx
      .insert(s.permission)
      .values(
        PERMISSION_MODULES.flatMap((m) =>
          m.codes.map((code) => ({ code, module: m.module })),
        ),
      )
      .onConflictDoUpdate({
        target: s.permission.code,
        set: { module: sql`excluded.module` },
      })
      .returning({
        code: s.permission.code,
        inserted: sql<boolean>`xmax = 0`,
      });
    const fresh = perms.filter((p) => p.inserted).map((p) => p.code);

    await tx
      .insert(s.role)
      .values([
        { code: 'CLERK', nameEn: 'Clerk', nameUr: 'کلرک' },
        { code: 'PRINCIPAL', nameEn: 'Principal', nameUr: 'پرنسپل' },
      ])
      .onConflictDoNothing();
    const roles = await tx
      .select()
      .from(s.role)
      .where(
        and(
          isNull(s.role.schoolId),
          inArray(s.role.code, ['CLERK', 'PRINCIPAL']),
        ),
      );
    const roleId = (code: string) => roles.find((r) => r.code === code)!.id;
    // Principal always holds every code. Clerk only receives codes that are new, so the
    // principal's choices in the Roles screen survive upgrades (SPEC §T12).
    const clerkNew = fresh.filter((c) => !CLERK_DEFAULT_EXCLUDED.includes(c));
    await tx
      .insert(s.rolePermission)
      .values([
        ...PERMISSION_CODES.map((c) => ({
          roleId: roleId('PRINCIPAL'),
          permissionCode: c,
        })),
        ...clerkNew.map((c) => ({
          roleId: roleId('CLERK'),
          permissionCode: c,
        })),
      ])
      .onConflictDoNothing();

    // One installation row (license/branding/backup config); the developer profile owns it.
    const [inst] = await tx
      .select({ id: s.installation.id })
      .from(s.installation)
      .limit(1);
    if (!inst) await tx.insert(s.installation).values({});

    const schoolId = DEMO_SCHOOL_ID;
    await tx
      .insert(s.school)
      .values({
        id: schoolId,
        nameEn: 'Demo Public School',
        nameUr: 'ڈیمو پبلک اسکول',
        address: 'Main Road, Hyderabad',
        phone: '022-0000000',
        devicePrefix: 'D1',
      })
      .onConflictDoNothing();
    await tx
      .insert(s.device)
      .values({ schoolId, name: 'Office PC', prefix: 'D1', kind: 'pc' })
      .onConflictDoNothing();
    await tx
      .insert(s.counter)
      .values({ schoolId, key: 'adm', value: 0 })
      .onConflictDoNothing();

    await tx
      .insert(s.academicYear)
      .values({
        schoolId,
        label: '2026-27',
        startsOn: '2026-04-01',
        endsOn: '2027-03-31',
        isCurrent: true,
      })
      .onConflictDoNothing();
    const [year] = await tx
      .select()
      .from(s.academicYear)
      .where(
        and(
          eq(s.academicYear.schoolId, schoolId),
          eq(s.academicYear.label, '2026-27'),
        ),
      );

    await tx
      .insert(s.schoolClass)
      .values(
        [1, 2, 3, 4, 5].map((level) => ({
          schoolId,
          level,
          nameEn: `Class ${level}`,
          nameUr: `جماعت ${URDU_DIGITS[level - 1]}`,
        })),
      )
      .onConflictDoNothing();
    const classes = await tx
      .select()
      .from(s.schoolClass)
      .where(eq(s.schoolClass.schoolId, schoolId));
    await tx
      .insert(s.section)
      .values(
        classes.flatMap((c) =>
          ['A', 'B'].map((name) => ({
            schoolId,
            classId: c.id,
            yearId: year.id,
            name,
          })),
        ),
      )
      .onConflictDoNothing();

    await tx
      .insert(s.feeHead)
      .values([
        {
          schoolId,
          code: 'TUI',
          nameEn: 'Tuition',
          nameUr: 'ٹیوشن فیس',
          priority: 10,
        },
        {
          schoolId,
          code: 'EXM',
          nameEn: 'Exam',
          nameUr: 'امتحانی فیس',
          priority: 20,
        },
        {
          schoolId,
          code: 'ADV',
          nameEn: 'Advance',
          nameUr: 'ایڈوانس',
          priority: 999,
        },
      ])
      .onConflictDoNothing();
    const heads = await tx
      .select()
      .from(s.feeHead)
      .where(eq(s.feeHead.schoolId, schoolId));
    const headId = (code: string) => heads.find((h) => h.code === code)!.id;
    await tx
      .insert(s.feeStructure)
      .values(
        classes.flatMap((c) => [
          {
            schoolId,
            classId: c.id,
            yearId: year.id,
            headId: headId('TUI'),
            amountPaisa: 300000,
            frequency: 'monthly' as const,
          },
          {
            schoolId,
            classId: c.id,
            yearId: year.id,
            headId: headId('EXM'),
            amountPaisa: 50000,
            frequency: 'yearly' as const,
          },
        ]),
      )
      .onConflictDoNothing();

    const users = [
      {
        username: 'principal',
        role: 'PRINCIPAL',
        nameEn: 'Principal',
        nameUr: 'پرنسپل',
      },
      {
        username: 'clerk',
        role: 'CLERK',
        nameEn: 'Office Clerk',
        nameUr: 'دفتری کلرک',
      },
    ];
    for (const u of users) {
      // person has no natural key, so check the account first to stay idempotent
      let [account] = await tx
        .select({ id: s.userAccount.id })
        .from(s.userAccount)
        .where(
          and(
            eq(s.userAccount.schoolId, schoolId),
            eq(s.userAccount.username, u.username),
          ),
        );
      if (!account) {
        const [p] = await tx
          .insert(s.person)
          .values({
            schoolId,
            kind: 'staff',
            nameEn: u.nameEn,
            nameUr: u.nameUr,
            searchText: u.nameEn.toLowerCase(),
          })
          .returning({ id: s.person.id });
        [account] = await tx
          .insert(s.userAccount)
          .values({
            schoolId,
            personId: p.id,
            username: u.username,
            passwordHash,
            pinHash,
          })
          .returning({ id: s.userAccount.id });
      }
      await tx
        .insert(s.userRole)
        .values({
          schoolId,
          userId: account.id,
          roleId: roleId(u.role),
          scopeType: 'school',
          scopeId: schoolId,
        })
        .onConflictDoNothing();
    }
  });
}

if (require.main === module) {
  const env = loadScriptEnv();
  const pool = new Pool({ connectionString: env.DATABASE_ADMIN_URL, max: 1 });
  seed(drizzle({ client: pool, schema: s, casing: 'snake_case' }))
    .then(() => console.log('seed complete'))
    .catch((err: unknown) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => void pool.end());
}
