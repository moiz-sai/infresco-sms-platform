import { hash } from '@node-rs/argon2';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Db } from './database.module';
import * as s from './schema';
import { loadScriptEnv } from './script-env';

export const PERMISSIONS: Record<string, string> = {
  'students.view': 'students',
  'students.edit': 'students',
  'attendance.mark': 'attendance',
  'attendance.view': 'attendance',
  'fees.configure': 'fees',
  'fees.collect': 'fees',
  'fees.discount': 'fees',
  'fees.reverse.request': 'fees',
  'approvals.decide': 'approvals',
  'dashboard.view': 'dashboard',
  'users.manage': 'users',
  'audit.view': 'audit',
  'settings.manage': 'settings',
};

const CLERK_EXCLUDED = [
  'approvals.decide',
  'users.manage',
  'settings.manage',
  'audit.view',
];

export const DEMO_SCHOOL_ID = '019a0000-0000-7000-8000-000000000001';
const DEMO_PASSWORD = 'Admin@123';
const DEMO_PIN = '1234';
const URDU_DIGITS = ['۱', '۲', '۳', '۴', '۵'];

export async function seed(db: Db) {
  const passwordHash = await hash(DEMO_PASSWORD);
  const pinHash = await hash(DEMO_PIN);

  await db.transaction(async (tx) => {
    const codes = Object.keys(PERMISSIONS);
    await tx
      .insert(s.permission)
      .values(codes.map((code) => ({ code, module: PERMISSIONS[code] })))
      .onConflictDoNothing();

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
    await tx
      .insert(s.rolePermission)
      .values([
        ...codes.map((c) => ({
          roleId: roleId('PRINCIPAL'),
          permissionCode: c,
        })),
        ...codes
          .filter((c) => !CLERK_EXCLUDED.includes(c))
          .map((c) => ({ roleId: roleId('CLERK'), permissionCode: c })),
      ])
      .onConflictDoNothing();

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
