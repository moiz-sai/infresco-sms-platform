import { Injectable } from '@nestjs/common';
import {
  attendancePct,
  type AttendanceStatus,
  type ClassRate,
  type Dashboard,
  type EnrollmentSummary,
} from '@sms/shared';
import { ApprovalsService } from '../approvals/approvals.service';
import { AttendanceService } from '../attendance/attendance.service';
import { DashboardCache } from '../common/dashboard-cache.service';
import { currentPeriod, FeesService } from '../fees/fees.service';
import { SetupService, type SectionInfo } from '../setup/setup.service';
import { StudentsService } from '../students/students.service';

const localDate = (d: Date) => d.toLocaleDateString('en-CA');
const ABSENTEE_LIMIT = 50;
const TREND_DAYS = 30;

type ClassAcc = {
  classId: string;
  classNameEn: string;
  classNameUr: string | null;
  num: number;
  den: number;
};

// Groups per-section numbers into per-class percentages, in class order.
function classRates(
  sections: SectionInfo[],
  add: (sectionId: string, acc: { num: number; den: number }) => void,
): ClassRate[] {
  const byClass = new Map<string, ClassAcc>();
  for (const s of sections) {
    const acc = byClass.get(s.classId) ?? {
      classId: s.classId,
      classNameEn: s.classNameEn,
      classNameUr: s.classNameUr,
      num: 0,
      den: 0,
    };
    add(s.id, acc);
    byClass.set(s.classId, acc);
  }
  return [...byClass.values()].map(({ num, den, ...c }) => ({
    ...c,
    pct: den > 0 ? Math.round((num * 1000) / den) / 10 : null,
  }));
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly cache: DashboardCache<Dashboard>,
    private readonly setup: SetupService,
    private readonly students: StudentsService,
    private readonly fees: FeesService,
    private readonly attendance: AttendanceService,
    private readonly approvals: ApprovalsService,
  ) {}

  async get(schoolId: string): Promise<Dashboard> {
    const cached = this.cache.get(schoolId);
    if (cached) return cached;
    const generation = this.cache.begin();
    const value = await this.build(schoolId);
    this.cache.set(schoolId, value, generation);
    return value;
  }

  private async build(schoolId: string): Promise<Dashboard> {
    const now = new Date();
    const date = localDate(now);
    const period = currentPeriod();
    const trendFrom = new Date(now);
    trendFrom.setDate(trendFrom.getDate() - (TREND_DAYS - 1));
    const year = await this.setup.currentYear(schoolId);

    const [
      sections,
      enrollments,
      figures,
      todayCollection,
      pending,
      lastCashClose,
    ] = await Promise.all([
      this.setup.listSections(schoolId, { yearId: year.id }),
      this.students.yearEnrollments(schoolId, year.id),
      this.fees.periodFigures(schoolId, period),
      this.fees.collectionOn(schoolId, date),
      this.approvals.list(schoolId, { status: 'pending', page: 1, size: 1 }),
      this.fees.lastCashClose(schoolId),
    ]);
    const active = enrollments.filter(
      (e) => e.status === 'active' && e.joinedOn <= date,
    );
    const activeIds = active.map((e) => e.enrollmentId);
    const [todayStatus, trendRows] = await Promise.all([
      this.attendance.dayStatuses(activeIds, date),
      this.attendance.dailyCounts(
        schoolId,
        enrollments.map((e) => e.enrollmentId),
        localDate(trendFrom),
        date,
      ),
    ]);

    // Fees: every enrollment of the year counts for the month; defaulters are active students only.
    let collectedPaisa = 0;
    let expectedPaisa = 0;
    const feeBySection = new Map<string, { num: number; den: number }>();
    for (const e of enrollments) {
      const f = figures.get(e.enrollmentId);
      if (!f) continue;
      collectedPaisa += f.collected;
      expectedPaisa += f.expected;
      const s = feeBySection.get(e.sectionId) ?? { num: 0, den: 0 };
      s.num += f.collected;
      s.den += f.expected;
      feeBySection.set(e.sectionId, s);
    }
    const owing = active
      .map((e) => figures.get(e.enrollmentId)?.balance ?? 0)
      .filter((b) => b > 0);

    const attBySection = new Map<
      string,
      Partial<Record<AttendanceStatus, number>>
    >();
    const absentIds: string[] = [];
    for (const e of active) {
      const st = todayStatus.get(e.enrollmentId);
      if (!st) continue;
      const c = attBySection.get(e.sectionId) ?? {};
      c[st] = (c[st] ?? 0) + 1;
      attBySection.set(e.sectionId, c);
      if (st === 'A') absentIds.push(e.enrollmentId);
    }

    const trend = new Map<string, Partial<Record<AttendanceStatus, number>>>();
    for (const r of trendRows) {
      const c = trend.get(r.date!) ?? {};
      c[r.status!] = (c[r.status!] ?? 0) + r.n;
      trend.set(r.date!, c);
    }

    const absentInfo = await this.students.enrollmentInfo(
      schoolId,
      absentIds.slice(0, ABSENTEE_LIMIT),
    );

    return {
      date,
      period,
      todayCollection: todayCollection.map((r) => ({ ...r })),
      month: { collectedPaisa, expectedPaisa },
      collectionByClass: classRates(sections, (id, acc) => {
        const s = feeBySection.get(id);
        if (s) {
          acc.num += s.num;
          acc.den += s.den;
        }
      }),
      attendanceByClass: classRates(sections, (id, acc) => {
        const c = attBySection.get(id);
        if (c) {
          acc.num += c.P ?? 0;
          acc.den += (c.P ?? 0) + (c.A ?? 0) + (c.L ?? 0);
        }
      }),
      attendanceTrend: [...trend].flatMap(([d, c]) => {
        const pct = attendancePct(c);
        return pct === null ? [] : [{ date: d, pct }];
      }),
      absentees: [...absentInfo.values()].map((i) => ({
        enrollmentId: i.enrollmentId,
        studentId: i.studentId,
        nameEn: i.nameEn,
        nameUr: i.nameUr,
        classNameEn: i.classNameEn,
        classNameUr: i.classNameUr,
        sectionName: i.sectionName,
      })),
      defaulters: {
        count: owing.length,
        totalPaisa: owing.reduce((a, b) => a + b, 0),
      },
      pendingApprovals: pending.total,
      lastCashClose,
      enrollment: this.enrollmentSummary(sections, enrollments, period),
    };
  }

  // SPEC §Z7. "Joined" = first-ever enrollment (promotions don't count); "left" uses left_on.
  private enrollmentSummary(
    sections: SectionInfo[],
    enrollments: Awaited<ReturnType<StudentsService['yearEnrollments']>>,
    period: string,
  ): EnrollmentSummary {
    const active = enrollments.filter((e) => e.status === 'active');
    const perSection = new Map<string, number>();
    for (const e of active)
      perSection.set(e.sectionId, (perSection.get(e.sectionId) ?? 0) + 1);
    const classes = new Map<string, EnrollmentSummary['classes'][number]>();
    for (const s of sections) {
      const c = classes.get(s.classId) ?? {
        classId: s.classId,
        classNameEn: s.classNameEn,
        classNameUr: s.classNameUr,
        total: 0,
        sections: [],
      };
      const n = perSection.get(s.id) ?? 0;
      c.total += n;
      c.sections.push({ sectionId: s.id, name: s.name, total: n });
      classes.set(s.classId, c);
    }
    return {
      total: active.length,
      boys: active.filter((e) => e.gender === 'm').length,
      girls: active.filter((e) => e.gender === 'f').length,
      genderUnset: active.filter((e) => !e.gender).length,
      joinedThisMonth: enrollments.filter(
        (e) => e.isFirst && e.joinedOn.startsWith(period),
      ).length,
      leftThisMonth: enrollments.filter(
        (e) => e.status === 'left' && !!e.leftOn?.startsWith(period),
      ).length,
      classes: [...classes.values()],
    };
  }
}
