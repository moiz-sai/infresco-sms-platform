// SPEC §T10 demo data, written through the real services (receipts, ledger, audit, approvals stay
// consistent). Run after db:seed: `pnpm --filter api db:seed-demo`. Refuses to run twice.
import { NestFactory } from '@nestjs/core';
import type { AttendanceStatus } from '@sms/shared';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AppModule } from '../app.module';
import { AttendanceService } from '../attendance/attendance.service';
import type { Actor } from '../common/actor';
import { FeesService } from '../fees/fees.service';
import { SetupService } from '../setup/setup.service';
import { StudentsService } from '../students/students.service';
import { DB, type Db } from './database.module';
import { DEMO_SCHOOL_ID } from './seed';
import { loadScriptEnv } from './script-env';
import { withTx } from './tx';

type UserActor = Actor & { userId: string };

const STUDENTS_PER_SECTION = 30;
const ATTENDANCE_DAYS = 10;

const BOYS: [string, string][] = [
  ['Ahmed', 'احمد'],
  ['Ali', 'علی'],
  ['Bilal', 'بلال'],
  ['Hamza', 'حمزہ'],
  ['Usman', 'عثمان'],
  ['Hassan', 'حسن'],
  ['Hussain', 'حسین'],
  ['Zain', 'زین'],
  ['Saad', 'سعد'],
  ['Faisal', 'فیصل'],
  ['Imran', 'عمران'],
  ['Kashif', 'کاشف'],
  ['Danish', 'دانش'],
  ['Arsalan', 'ارسلان'],
  ['Rehan', 'ریحان'],
  ['Talha', 'طلحہ'],
  ['Umar', 'عمر'],
  ['Yasir', 'یاسر'],
  ['Junaid', 'جنید'],
  ['Fahad', 'فہد'],
];
const GIRLS: [string, string][] = [
  ['Ayesha', 'عائشہ'],
  ['Fatima', 'فاطمہ'],
  ['Zainab', 'زینب'],
  ['Maryam', 'مریم'],
  ['Hira', 'حرا'],
  ['Sana', 'ثنا'],
  ['Iqra', 'اقرا'],
  ['Amna', 'آمنہ'],
  ['Mahnoor', 'ماہ نور'],
  ['Kinza', 'کنزہ'],
  ['Laiba', 'لائبہ'],
  ['Areeba', 'اریبہ'],
  ['Hafsa', 'حفصہ'],
  ['Rabia', 'رابعہ'],
  ['Sadia', 'سعدیہ'],
];
const SURNAMES: [string, string][] = [
  ['Khan', 'خان'],
  ['Qureshi', 'قریشی'],
  ['Siddiqui', 'صدیقی'],
  ['Shaikh', 'شیخ'],
  ['Memon', 'میمن'],
  ['Baloch', 'بلوچ'],
  ['Abbasi', 'عباسی'],
  ['Ansari', 'انصاری'],
  ['Chandio', 'چانڈیو'],
  ['Soomro', 'سومرو'],
  ['Malik', 'ملک'],
  ['Butt', 'بٹ'],
  ['Hashmi', 'ہاشمی'],
  ['Rajput', 'راجپوت'],
  ['Mirza', 'مرزا'],
];

// Deterministic so every demo database looks the same.
let state = 20261025;
const rand = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];
const phone = () =>
  `03${Math.floor(rand() * 50 + 10)}-${String(Math.floor(rand() * 1e7)).padStart(7, '0')}`;
const localDate = (d: Date) => d.toLocaleDateString('en-CA');
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const at = (date: string, hour: number) =>
  new Date(`${date}T${String(hour).padStart(2, '0')}:15:00`);
const periodOf = (d: Date) => localDate(d).slice(0, 7);

async function main() {
  const env = loadScriptEnv();
  const admin = new Pool({ connectionString: env.DATABASE_ADMIN_URL, max: 1 });
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const db = app.get<Db>(DB);
    const setup = app.get(SetupService);
    const students = app.get(StudentsService);
    const fees = app.get(FeesService);
    const attendance = app.get(AttendanceService);

    const schoolId = DEMO_SCHOOL_ID;
    const year = await setup.currentYear(schoolId);
    const existing = (await students.yearEnrollments(schoolId, year.id)).filter(
      (e) => e.status === 'active',
    );
    if (existing.length >= 100) {
      console.log(
        `demo data already present (${existing.length} active students); nothing done`,
      );
      return;
    }

    const { rows: users } = await admin.query<{ id: string; username: string }>(
      `select id, username from user_account where school_id = $1 and username in ('principal', 'clerk')`,
      [schoolId],
    );
    const { rows: devices } = await admin.query<{ id: string }>(
      `select id from device where school_id = $1 limit 1`,
      [schoolId],
    );
    const actor = (username: string, canApprove: boolean): UserActor => ({
      schoolId,
      userId: users.find((u) => u.username === username)!.id,
      deviceId: devices[0]?.id ?? null,
      canApprove,
    });
    const principal = actor('principal', true);
    const clerk = actor('clerk', false);

    // Next year with the same sections, so the promote page has somewhere to go.
    const years = await setup.listYears(schoolId);
    const startYear = Number(year.startsOn.slice(0, 4)) + 1;
    const nextLabel = `${startYear}-${String(startYear + 1).slice(2)}`;
    let next = years.find((y) => y.label === nextLabel);
    next ??= await setup.saveYear(principal, {
      label: nextLabel,
      startsOn: `${startYear}-04-01`,
      endsOn: `${startYear + 1}-03-31`,
      isCurrent: false,
    });
    const nextSections = await setup.listSections(schoolId, {
      yearId: next.id,
    });
    for (const c of await setup.listClasses(schoolId)) {
      for (const name of ['A', 'B']) {
        if (!nextSections.some((s) => s.classId === c.id && s.name === name)) {
          await setup.saveSection(principal, {
            classId: c.id,
            yearId: next.id,
            name,
          });
        }
      }
    }

    // 300 students; about one in eight is a younger sibling of an earlier student.
    const sections = await setup.listSections(schoolId, { yearId: year.id });
    const families: {
      guardianId: string;
      surname: [string, string];
      father: string;
    }[] = [];
    const admitted: { studentId: string; enrollmentId: string }[] = [];
    for (const section of sections) {
      for (let roll = 1; roll <= STUDENTS_PER_SECTION; roll++) {
        const girl = rand() < 0.45;
        const [first, firstUr] = pick(girl ? GIRLS : BOYS);
        const family =
          families.length > 10 && rand() < 0.13 ? pick(families) : null;
        const surname = family?.surname ?? pick(SURNAMES);
        const father = family?.father ?? `${pick(BOYS)[0]} ${surname[0]}`;
        const res = await students.admit(clerk, {
          student: {
            nameEn: `${first} ${surname[0]}`,
            nameUr: `${firstUr} ${surname[1]}`,
            fatherName: father,
            gender: girl ? 'f' : 'm',
            phone: null,
            dob: null,
            bForm: null,
            address: null,
          },
          guardians: family
            ? [
                {
                  guardianId: family.guardianId,
                  relation: 'father',
                  isPrimary: true,
                },
              ]
            : [
                {
                  nameEn: father,
                  nameUr: null,
                  phone: phone(),
                  cnic: null,
                  relation: 'father',
                  isPrimary: true,
                },
              ],
          sectionId: section.id,
          rollNo: roll,
          // The last roll number of each section joined recently (shows on the dashboard).
          joinedOn:
            roll === STUDENTS_PER_SECTION
              ? localDate(daysAgo(12))
              : year.startsOn,
        });
        admitted.push(res);
        if (!family) {
          const detail = await students.get(schoolId, res.studentId);
          families.push({
            guardianId: detail.guardians[0].id,
            surname,
            father,
          });
        }
      }
    }
    console.log(`admitted ${admitted.length} students`);

    // Two months of charges, dated at the start of each month.
    const months = [periodOf(daysAgo(30)), periodOf(new Date())].filter(
      (p, i, all) => all.indexOf(p) === i,
    );
    for (const period of months) {
      const { inserted } = await fees.postCharges(principal, period);
      await admin.query(
        `update ledger_entry set created_at = $2 where type = 'charge' and period = $1`,
        [period, at(`${period}-01`, 7)],
      );
      console.log(`posted ${inserted} charges for ${period}`);
    }

    // ~55% pay everything, ~15% pay only the first month; receipts spread over each month.
    const today = localDate(new Date());
    let receipts = 0;
    for (const [i, s] of admitted.entries()) {
      const r = rand();
      if (r >= 0.7) continue;
      const statement = await fees.statement(schoolId, s.enrollmentId);
      const byPeriod = new Map<string, number>();
      for (const d of statement.dues) {
        byPeriod.set(d.period, (byPeriod.get(d.period) ?? 0) + d.amountPaisa);
      }
      const periods = [...byPeriod.keys()]
        .sort()
        .slice(0, r < 0.55 ? undefined : 1);
      for (const period of periods) {
        const method = rand() < 0.85 ? ('cash' as const) : ('bank' as const);
        const { receiptId } = await fees.pay(clerk, {
          enrollmentId: s.enrollmentId,
          amountPaisa: byPeriod.get(period)!,
          method,
        });
        receipts++;
        // The last few stay "today" so the dashboard shows a live day.
        if (i < admitted.length - 15 || period !== periodOf(new Date())) {
          const lastDay =
            period === periodOf(new Date()) ? Number(today.slice(8)) - 1 : 25;
          const day = String(Math.max(1, Math.ceil(rand() * lastDay))).padStart(
            2,
            '0',
          );
          const when = at(`${period}-${day}`, 9 + Math.floor(rand() * 5));
          await admin.query(
            `update receipt set created_at = $2 where id = $1`,
            [receiptId, when],
          );
          await admin.query(
            `update ledger_entry set created_at = $2 where receipt_id = $1`,
            [receiptId, when],
          );
        }
      }
    }
    console.log(`${receipts} receipts`);

    // Attendance for the last school days (Sundays off): mostly present.
    let marked = 0;
    for (let back = 0, days = 0; days < ATTENDANCE_DAYS; back++) {
      const d = daysAgo(back);
      if (d.getDay() === 0) continue;
      days++;
      const date = localDate(d);
      for (const section of sections) {
        const roster = await students.sectionRoster(
          schoolId,
          section.id,
          date,
          date,
        );
        const entries = roster.map((r) => {
          const x = rand();
          const status: AttendanceStatus =
            x < 0.88 ? 'P' : x < 0.95 ? 'A' : x < 0.99 ? 'L' : 'V';
          return { id: randomUUID(), enrollmentId: r.enrollmentId, status };
        });
        await withTx(db, (tx) =>
          attendance.applyEntries(tx, clerk, section.id, date, entries),
        );
        marked += entries.length;
      }
    }
    console.log(`${marked} attendance marks`);

    // Yesterday's cash closed Rs 200 short, so the dashboard shows a difference.
    const yesterday = localDate(daysAgo(1));
    const view = await fees.cashCloseView(schoolId, yesterday);
    if (!view.close)
      await fees.closeCash(
        principal,
        yesterday,
        Math.max(0, view.systemTotalPaisa - 20000),
      );

    // Two students left this month.
    for (const s of admitted.slice(5, 7)) {
      await students.leave(principal, s.studentId, {
        leftOn: localDate(daysAgo(3)),
        reason: 'Family moved',
      });
    }

    // Two requests waiting for the principal: a big discount and a receipt cancellation.
    let owing = admitted[0];
    let due;
    for (const s of admitted.slice(10)) {
      due = (await fees.statement(schoolId, s.enrollmentId)).dues.find(
        (d) => d.amountPaisa >= 150000,
      );
      owing = s;
      if (due) break;
    }
    if (due) {
      await fees.discount(clerk, {
        enrollmentId: owing.enrollmentId,
        headId: due.headId,
        period: due.period,
        amountPaisa: 150000,
        reason: 'Father lost his job',
      });
    }
    const { rows: last } = await admin.query<{ id: string }>(
      `select id from receipt where school_id = $1 order by created_at desc limit 1`,
      [schoolId],
    );
    await fees.reverse(clerk, last[0].id, 'Wrong student selected');
    console.log('demo data complete');
  } finally {
    await app.close();
    await admin.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
