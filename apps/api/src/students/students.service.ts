import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildSearchText,
  normalizeUrdu,
  type AdmitInput,
  type AdmitResult,
  type LeaveInput,
  type Page,
  type PromoteInput,
  type StudentDetail,
  type StudentFields,
  type StudentListItem,
  type StudentListQuery,
} from '@sms/shared';
import { and, asc, count, desc, eq, ilike, inArray, isNull } from 'drizzle-orm';
import type { Actor } from '../common/actor';
import { AuditService } from '../common/audit.service';
import { CounterService } from '../common/counter.service';
import { Env } from '../config/env';
import { DB, type Db } from '../db/database.module';
import { enrollment, guardianStudent, person } from '../db/schema';
import { withTx, type Tx } from '../db/tx';
import { SetupService } from '../setup/setup.service';

const today = () => new Date().toLocaleDateString('en-CA');
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Student not found' });

const studentSearchText = (s: StudentFields, admissionNo: string) =>
  buildSearchText([
    s.nameEn,
    s.nameUr,
    s.fatherName,
    admissionNo,
    s.phone,
    s.bForm,
  ]);

@Injectable()
export class StudentsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly counter: CounterService,
    private readonly setup: SetupService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async admit(actor: Actor, input: AdmitInput): Promise<AdmitResult> {
    const sec = await this.setup.getSection(actor.schoolId, input.sectionId);
    const prefix = this.config.get('DEVICE_PREFIX', { infer: true });
    const guardians = input.guardians.map((g, i) => ({
      ...g,
      isPrimary:
        g.isPrimary || (i === 0 && !input.guardians.some((x) => x.isPrimary)),
    }));

    return withTx(this.db, async (tx) => {
      const seq = await this.counter.next(tx, actor.schoolId, 'adm');
      const admissionNo = `${prefix}-${String(seq).padStart(6, '0')}`;
      const [student] = await tx
        .insert(person)
        .values({
          ...input.student,
          schoolId: actor.schoolId,
          kind: 'student',
          searchText: studentSearchText(input.student, admissionNo),
        })
        .returning({ id: person.id });
      await this.audit.record(tx, actor, {
        action: 'student.admit',
        entity: 'person',
        entityId: student.id,
        after: { ...input.student, admissionNo },
      });

      for (const g of guardians) {
        const guardianId =
          'guardianId' in g
            ? await this.existingGuardian(tx, actor.schoolId, g.guardianId)
            : await this.createGuardian(tx, actor, g);
        await tx.insert(guardianStudent).values({
          schoolId: actor.schoolId,
          guardianId,
          studentId: student.id,
          relation: g.relation,
          isPrimary: g.isPrimary,
        });
      }

      const [enr] = await tx
        .insert(enrollment)
        .values({
          schoolId: actor.schoolId,
          studentId: student.id,
          sectionId: sec.id,
          yearId: sec.yearId,
          rollNo: input.rollNo ?? null,
          admissionNo,
          joinedOn: input.joinedOn,
        })
        .returning({ id: enrollment.id });
      await this.audit.record(tx, actor, {
        action: 'enrollment.create',
        entity: 'enrollment',
        entityId: enr.id,
        after: { studentId: student.id, sectionId: sec.id, admissionNo },
      });
      return { studentId: student.id, enrollmentId: enr.id, admissionNo };
    });
  }

  private async existingGuardian(tx: Tx, schoolId: string, id: string) {
    const [g] = await tx
      .select({ id: person.id })
      .from(person)
      .where(
        and(
          eq(person.id, id),
          eq(person.schoolId, schoolId),
          eq(person.kind, 'guardian'),
          isNull(person.deletedAt),
        ),
      );
    if (!g) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Guardian not found',
      });
    }
    return g.id;
  }

  private async createGuardian(
    tx: Tx,
    actor: Actor,
    g: {
      nameEn: string;
      nameUr?: string | null;
      phone?: string | null;
      cnic?: string | null;
    },
  ) {
    const fields = {
      nameEn: g.nameEn,
      nameUr: g.nameUr ?? null,
      phone: g.phone ?? null,
      cnic: g.cnic ?? null,
    };
    const [row] = await tx
      .insert(person)
      .values({
        ...fields,
        schoolId: actor.schoolId,
        kind: 'guardian',
        searchText: buildSearchText([g.nameEn, g.nameUr, g.phone, g.cnic]),
      })
      .returning({ id: person.id });
    await this.audit.record(tx, actor, {
      action: 'guardian.create',
      entity: 'person',
      entityId: row.id,
      after: fields,
    });
    return row.id;
  }

  async list(
    schoolId: string,
    q: StudentListQuery,
  ): Promise<Page<StudentListItem>> {
    const sections = (
      await this.setup.listSections(schoolId, {
        yearId: q.yearId,
        classId: q.classId,
      })
    ).filter((s) => !q.sectionId || s.id === q.sectionId);
    if (sections.length === 0) return { items: [], total: 0 };
    const bySection = new Map(sections.map((s) => [s.id, s]));
    const term = q.q ? normalizeUrdu(q.q) : '';

    const where = and(
      eq(enrollment.schoolId, schoolId),
      inArray(enrollment.sectionId, [...bySection.keys()]),
      eq(enrollment.status, q.status),
      isNull(enrollment.deletedAt),
      term ? ilike(person.searchText, `%${escapeLike(term)}%`) : undefined,
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          studentId: person.id,
          enrollmentId: enrollment.id,
          admissionNo: enrollment.admissionNo,
          rollNo: enrollment.rollNo,
          nameEn: person.nameEn,
          nameUr: person.nameUr,
          fatherName: person.fatherName,
          gender: person.gender,
          phone: person.phone,
          sectionId: enrollment.sectionId,
          status: enrollment.status,
        })
        .from(enrollment)
        .innerJoin(person, eq(person.id, enrollment.studentId))
        .where(where)
        .orderBy(asc(person.nameEn), asc(enrollment.admissionNo))
        .limit(q.size)
        .offset((q.page - 1) * q.size),
      this.db
        .select({ total: count() })
        .from(enrollment)
        .innerJoin(person, eq(person.id, enrollment.studentId))
        .where(where),
    ]);
    const items = rows.map((r) => {
      const s = bySection.get(r.sectionId)!;
      return {
        ...r,
        classId: s.classId,
        classNameEn: s.classNameEn,
        classNameUr: s.classNameUr,
        sectionName: s.name,
      };
    });
    return { items, total };
  }

  async get(schoolId: string, id: string): Promise<StudentDetail> {
    const [p] = await this.db
      .select({
        id: person.id,
        nameEn: person.nameEn,
        nameUr: person.nameUr,
        fatherName: person.fatherName,
        gender: person.gender,
        dob: person.dob,
        bForm: person.bForm,
        phone: person.phone,
        address: person.address,
        status: person.status,
      })
      .from(person)
      .where(this.studentWhere(schoolId, id));
    if (!p) throw notFound();

    const [guardians, enrollments] = await Promise.all([
      this.db
        .select({
          id: person.id,
          nameEn: person.nameEn,
          nameUr: person.nameUr,
          phone: person.phone,
          cnic: person.cnic,
          relation: guardianStudent.relation,
          isPrimary: guardianStudent.isPrimary,
        })
        .from(guardianStudent)
        .innerJoin(person, eq(person.id, guardianStudent.guardianId))
        .where(
          and(
            eq(guardianStudent.studentId, id),
            isNull(guardianStudent.deletedAt),
          ),
        )
        .orderBy(desc(guardianStudent.isPrimary), asc(person.nameEn)),
      this.db
        .select()
        .from(enrollment)
        .where(and(eq(enrollment.studentId, id), isNull(enrollment.deletedAt)))
        .orderBy(desc(enrollment.joinedOn), desc(enrollment.createdAt)),
    ]);
    const sections = await this.setup.describeSections(
      schoolId,
      enrollments.map((e) => e.sectionId),
    );
    return {
      ...p,
      gender: p.gender ?? 'm',
      guardians,
      enrollments: enrollments.map((e) => {
        const s = sections.get(e.sectionId);
        return {
          id: e.id,
          admissionNo: e.admissionNo,
          rollNo: e.rollNo,
          yearLabel: s?.yearLabel ?? '',
          classNameEn: s?.classNameEn ?? '',
          classNameUr: s?.classNameUr ?? null,
          sectionId: e.sectionId,
          sectionName: s?.name ?? '',
          joinedOn: e.joinedOn,
          leftOn: e.leftOn,
          status: e.status,
        };
      }),
    };
  }

  async update(actor: Actor, id: string, fields: StudentFields) {
    return withTx(this.db, async (tx) => {
      const [before] = await tx
        .select()
        .from(person)
        .where(this.studentWhere(actor.schoolId, id));
      if (!before) throw notFound();
      const [latest] = await tx
        .select({ admissionNo: enrollment.admissionNo })
        .from(enrollment)
        .where(eq(enrollment.studentId, id))
        .orderBy(desc(enrollment.createdAt))
        .limit(1);
      await tx
        .update(person)
        .set({
          ...fields,
          searchText: studentSearchText(fields, latest?.admissionNo ?? ''),
        })
        .where(eq(person.id, id));
      await this.audit.record(tx, actor, {
        action: 'student.update',
        entity: 'person',
        entityId: id,
        before,
        after: fields,
      });
      return { id };
    });
  }

  async leave(actor: Actor, id: string, input: LeaveInput) {
    return withTx(this.db, async (tx) => {
      const [enr] = await tx
        .update(enrollment)
        .set({ status: 'left', leftOn: input.leftOn })
        .where(
          and(
            eq(enrollment.studentId, id),
            eq(enrollment.schoolId, actor.schoolId),
            eq(enrollment.status, 'active'),
          ),
        )
        .returning({ id: enrollment.id });
      if (!enr) throw notFound();
      await tx.update(person).set({ status: 'left' }).where(eq(person.id, id));
      await this.audit.record(tx, actor, {
        action: 'student.leave',
        entity: 'enrollment',
        entityId: enr.id,
        after: input,
      });
      return { enrollmentId: enr.id };
    });
  }

  async promote(actor: Actor, input: PromoteInput) {
    const [from, to] = await Promise.all([
      this.setup.getSection(actor.schoolId, input.fromSectionId),
      this.setup.getSection(actor.schoolId, input.toSectionId),
    ]);
    const studentIds = [...new Set(input.studentIds)];
    const now = today();
    const joinedOn = to.yearStartsOn > now ? to.yearStartsOn : now;

    return withTx(this.db, async (tx) => {
      const current = await tx
        .select()
        .from(enrollment)
        .where(
          and(
            eq(enrollment.sectionId, from.id),
            eq(enrollment.status, 'active'),
            inArray(enrollment.studentId, studentIds),
          ),
        )
        .for('update');
      if (current.length !== studentIds.length) {
        const found = new Set(current.map((e) => e.studentId));
        throw new BadRequestException({
          code: 'NOT_IN_SECTION',
          message: `Not active in the source section: ${studentIds.filter((s) => !found.has(s)).join(', ')}`,
        });
      }
      for (const e of current) {
        await tx
          .update(enrollment)
          .set({ status: 'promoted', leftOn: now })
          .where(eq(enrollment.id, e.id));
        const [next] = await tx
          .insert(enrollment)
          .values({
            schoolId: actor.schoolId,
            studentId: e.studentId,
            sectionId: to.id,
            yearId: to.yearId,
            rollNo: e.rollNo,
            admissionNo: e.admissionNo,
            joinedOn,
          })
          .returning({ id: enrollment.id });
        await this.audit.record(tx, actor, {
          action: 'enrollment.promote',
          entity: 'enrollment',
          entityId: next.id,
          before: { enrollmentId: e.id, sectionId: from.id },
          after: { enrollmentId: next.id, sectionId: to.id },
        });
      }
      return { promoted: current.length };
    });
  }

  private studentWhere(schoolId: string, id: string) {
    return and(
      eq(person.id, id),
      eq(person.schoolId, schoolId),
      eq(person.kind, 'student'),
      isNull(person.deletedAt),
    );
  }
}
