import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ClassInput,
  School,
  SchoolUpdate,
  SectionInput,
  SectionListQuery,
  YearInput,
} from '@sms/shared';
import { and, asc, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import type { Actor } from '../common/actor';
import { AuditService } from '../common/audit.service';
import { DB, type Db } from '../db/database.module';
import {
  academicYear,
  DEFAULT_SCHOOL_SETTINGS,
  school,
  schoolClass,
  section,
  type SchoolSettings,
} from '../db/schema';
import { withTx } from '../db/tx';

export interface SectionInfo {
  id: string;
  name: string;
  classId: string;
  classNameEn: string;
  classNameUr: string | null;
  classLevel: number;
  yearId: string;
  yearLabel: string;
  yearStartsOn: string;
  yearEndsOn: string;
}

const notFound = (what: string) =>
  new NotFoundException({ code: 'NOT_FOUND', message: `${what} not found` });

// Setup rows are hard-deleted: FKs from sections/enrollments/fees turn a delete of a used row into 409 IN_USE.
@Injectable()
export class SetupService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async getSchool(schoolId: string): Promise<School> {
    const [row] = await this.db
      .select({
        id: school.id,
        nameEn: school.nameEn,
        nameUr: school.nameUr,
        address: school.address,
        phone: school.phone,
        devicePrefix: school.devicePrefix,
      })
      .from(school)
      .where(eq(school.id, schoolId));
    if (!row) throw notFound('School');
    return row;
  }

  async getSettings(schoolId: string): Promise<SchoolSettings> {
    const [row] = await this.db
      .select({ settings: school.settings })
      .from(school)
      .where(eq(school.id, schoolId));
    if (!row) throw notFound('School');
    return { ...DEFAULT_SCHOOL_SETTINGS, ...row.settings };
  }

  async updateSchool(actor: Actor, input: SchoolUpdate): Promise<School> {
    const before = await this.getSchool(actor.schoolId);
    await withTx(this.db, async (tx) => {
      await tx.update(school).set(input).where(eq(school.id, actor.schoolId));
      await this.audit.record(tx, actor, {
        action: 'school.update',
        entity: 'school',
        entityId: actor.schoolId,
        before,
        after: input,
      });
    });
    return this.getSchool(actor.schoolId);
  }

  listYears(schoolId: string) {
    return this.db
      .select()
      .from(academicYear)
      .where(
        and(
          eq(academicYear.schoolId, schoolId),
          isNull(academicYear.deletedAt),
        ),
      )
      .orderBy(desc(academicYear.startsOn));
  }

  async currentYear(schoolId: string) {
    const [row] = await this.db
      .select()
      .from(academicYear)
      .where(
        and(
          eq(academicYear.schoolId, schoolId),
          eq(academicYear.isCurrent, true),
          isNull(academicYear.deletedAt),
        ),
      );
    if (!row) {
      throw new ConflictException({
        code: 'NO_CURRENT_YEAR',
        message: 'No current academic year; set one in Setup',
      });
    }
    return row;
  }

  saveYear(actor: Actor, input: YearInput, id?: string) {
    return withTx(this.db, async (tx) => {
      if (input.isCurrent) {
        await tx
          .update(academicYear)
          .set({ isCurrent: false })
          .where(
            and(
              eq(academicYear.schoolId, actor.schoolId),
              eq(academicYear.isCurrent, true),
            ),
          );
      }
      const [row] = id
        ? await tx
            .update(academicYear)
            .set(input)
            .where(
              and(
                eq(academicYear.id, id),
                eq(academicYear.schoolId, actor.schoolId),
              ),
            )
            .returning()
        : await tx
            .insert(academicYear)
            .values({ ...input, schoolId: actor.schoolId })
            .returning();
      if (!row) throw notFound('Year');
      await this.audit.record(tx, actor, {
        action: id ? 'year.update' : 'year.create',
        entity: 'academic_year',
        entityId: row.id,
        after: input,
      });
      return row;
    });
  }

  deleteYear(actor: Actor, id: string) {
    return this.hardDelete(actor, academicYear, id, 'year');
  }

  listClasses(schoolId: string) {
    return this.db
      .select()
      .from(schoolClass)
      .where(
        and(eq(schoolClass.schoolId, schoolId), isNull(schoolClass.deletedAt)),
      )
      .orderBy(asc(schoolClass.level));
  }

  saveClass(actor: Actor, input: ClassInput, id?: string) {
    return withTx(this.db, async (tx) => {
      const [row] = id
        ? await tx
            .update(schoolClass)
            .set(input)
            .where(
              and(
                eq(schoolClass.id, id),
                eq(schoolClass.schoolId, actor.schoolId),
              ),
            )
            .returning()
        : await tx
            .insert(schoolClass)
            .values({ ...input, schoolId: actor.schoolId })
            .returning();
      if (!row) throw notFound('Class');
      await this.audit.record(tx, actor, {
        action: id ? 'class.update' : 'class.create',
        entity: 'class',
        entityId: row.id,
        after: input,
      });
      return row;
    });
  }

  deleteClass(actor: Actor, id: string) {
    return this.hardDelete(actor, schoolClass, id, 'class');
  }

  // Defaults to the current year when no yearId is given.
  async listSections(
    schoolId: string,
    q: SectionListQuery,
  ): Promise<SectionInfo[]> {
    const yearId = q.yearId ?? (await this.currentYear(schoolId)).id;
    return this.sectionInfoQuery(schoolId, [
      eq(section.yearId, yearId),
      q.classId ? eq(section.classId, q.classId) : undefined,
    ]);
  }

  async describeSections(
    schoolId: string,
    ids: string[],
  ): Promise<Map<string, SectionInfo>> {
    if (ids.length === 0) return new Map();
    const rows = await this.sectionInfoQuery(schoolId, [
      inArray(section.id, [...new Set(ids)]),
    ]);
    return new Map(rows.map((r) => [r.id, r]));
  }

  async getSection(schoolId: string, id: string): Promise<SectionInfo> {
    const info = (await this.describeSections(schoolId, [id])).get(id);
    if (!info) throw notFound('Section');
    return info;
  }

  private sectionInfoQuery(schoolId: string, filters: (SQL | undefined)[]) {
    return this.db
      .select({
        id: section.id,
        name: section.name,
        classId: section.classId,
        classNameEn: schoolClass.nameEn,
        classNameUr: schoolClass.nameUr,
        classLevel: schoolClass.level,
        yearId: section.yearId,
        yearLabel: academicYear.label,
        yearStartsOn: academicYear.startsOn,
        yearEndsOn: academicYear.endsOn,
      })
      .from(section)
      .innerJoin(schoolClass, eq(schoolClass.id, section.classId))
      .innerJoin(academicYear, eq(academicYear.id, section.yearId))
      .where(
        and(
          eq(section.schoolId, schoolId),
          isNull(section.deletedAt),
          ...filters,
        ),
      )
      .orderBy(asc(schoolClass.level), asc(section.name));
  }

  saveSection(actor: Actor, input: SectionInput, id?: string) {
    return withTx(this.db, async (tx) => {
      const [row] = id
        ? await tx
            .update(section)
            .set(input)
            .where(
              and(eq(section.id, id), eq(section.schoolId, actor.schoolId)),
            )
            .returning()
        : await tx
            .insert(section)
            .values({ ...input, schoolId: actor.schoolId })
            .returning();
      if (!row) throw notFound('Section');
      await this.audit.record(tx, actor, {
        action: id ? 'section.update' : 'section.create',
        entity: 'section',
        entityId: row.id,
        after: input,
      });
      return row;
    });
  }

  deleteSection(actor: Actor, id: string) {
    return this.hardDelete(actor, section, id, 'section');
  }

  private hardDelete(
    actor: Actor,
    table: typeof academicYear | typeof schoolClass | typeof section,
    id: string,
    entity: string,
  ) {
    return withTx(this.db, async (tx) => {
      const [row] = await tx
        .delete(table)
        .where(and(eq(table.id, id), eq(table.schoolId, actor.schoolId)))
        .returning();
      if (!row) throw notFound(entity);
      await this.audit.record(tx, actor, {
        action: `${entity}.delete`,
        entity: entity === 'year' ? 'academic_year' : entity,
        entityId: id,
        before: row,
      });
    });
  }
}
