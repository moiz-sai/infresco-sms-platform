import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  char,
  date,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// Column names are derived from keys via `casing: 'snake_case'` (drizzle.config.ts + DatabaseModule).

export interface SchoolSettings {
  attendanceLockDays: number;
  discountThresholdPaisa: number;
  allocation: 'oldest_first';
}

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  attendanceLockDays: 3,
  discountThresholdPaisa: 100000,
  allocation: 'oldest_first',
};

// Append-only tables: UPDATE/DELETE revoked from sms_app in migration 0001.
export const APPEND_ONLY_TABLES = [
  'audit_log',
  'attendance_event',
  'ledger_entry',
  'receipt',
  'cash_close',
] as const;

const tz = () => timestamp({ withTimezone: true });
const pk = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);
const paisa = () => bigint({ mode: 'number' });
const created = () => ({ createdAt: tz().notNull().defaultNow() });
const mutable = () => ({
  createdAt: tz().notNull().defaultNow(),
  updatedAt: tz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: tz(),
});
const tenant = () => ({
  id: pk(),
  schoolId: uuid()
    .notNull()
    .references(() => school.id),
});

export const personKind = pgEnum('person_kind', [
  'student',
  'staff',
  'guardian',
]);
export const gender = pgEnum('gender', ['m', 'f']);
export const personStatus = pgEnum('person_status', ['active', 'left']);
export const scopeType = pgEnum('scope_type', ['school', 'section']);
export const deviceKind = pgEnum('device_kind', ['pc', 'phone']);
export const enrollmentStatus = pgEnum('enrollment_status', [
  'active',
  'left',
  'promoted',
]);
export const attendanceStatus = pgEnum('attendance_status', [
  'P',
  'A',
  'L',
  'V',
]);
export const feeFrequency = pgEnum('fee_frequency', [
  'monthly',
  'yearly',
  'once',
]);
export const discountType = pgEnum('discount_type', ['pct', 'fixed']);
export const paymentMethod = pgEnum('payment_method', [
  'cash',
  'bank',
  'online',
]);
export const ledgerType = pgEnum('ledger_type', [
  'charge',
  'payment',
  'adjust',
  'reversal',
]);
export const approvalAction = pgEnum('approval_action', [
  'fees.discount',
  'fees.reverse',
  'attendance.edit_old',
  // SPEC §Z6: promoting students who still owe fees
  'students.promote',
]);
export const approvalStatus = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
]);

export const school = pgTable('school', {
  id: pk(),
  nameEn: text().notNull(),
  nameUr: text(),
  address: text(),
  phone: text(),
  devicePrefix: text().notNull(),
  settings: jsonb()
    .$type<SchoolSettings>()
    .notNull()
    .default(DEFAULT_SCHOOL_SETTINGS),
  ...mutable(),
});

export const person = pgTable(
  'person',
  {
    ...tenant(),
    kind: personKind().notNull(),
    nameEn: text().notNull(),
    nameUr: text(),
    fatherName: text(),
    gender: gender(),
    dob: date(),
    bForm: text(),
    phone: text(),
    cnic: text(),
    address: text(),
    status: personStatus().notNull().default('active'),
    extra: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    searchText: text().notNull().default(''),
    ...mutable(),
  },
  // GIN trigram index on search_text: migration 0002 (needs pg_trgm).
  (t) => [index().on(t.schoolId, t.kind)],
);

export const userAccount = pgTable(
  'user_account',
  {
    ...tenant(),
    personId: uuid()
      .notNull()
      .unique()
      .references(() => person.id),
    username: text().notNull(),
    passwordHash: text().notNull(),
    pinHash: text(),
    isActive: boolean().notNull().default(true),
    failedCount: integer().notNull().default(0),
    lockedUntil: tz(),
    ...mutable(),
  },
  (t) => [unique().on(t.schoolId, t.username)],
);

export const role = pgTable(
  'role',
  {
    id: pk(),
    schoolId: uuid().references(() => school.id),
    code: text().notNull(),
    nameEn: text().notNull(),
    nameUr: text(),
    ...mutable(),
  },
  (t) => [unique().on(t.schoolId, t.code).nullsNotDistinct()],
);

export const permission = pgTable('permission', {
  code: text().primaryKey(),
  module: text().notNull(),
  ...created(),
});

export const rolePermission = pgTable(
  'role_permission',
  {
    roleId: uuid()
      .notNull()
      .references(() => role.id),
    permissionCode: text()
      .notNull()
      .references(() => permission.code),
    ...created(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionCode] })],
);

export const userRole = pgTable(
  'user_role',
  {
    ...tenant(),
    userId: uuid()
      .notNull()
      .references(() => userAccount.id),
    roleId: uuid()
      .notNull()
      .references(() => role.id),
    scopeType: scopeType().notNull().default('school'),
    scopeId: uuid(),
    validFrom: date().notNull().defaultNow(),
    validTo: date(),
    ...mutable(),
  },
  (t) => [
    unique().on(t.userId, t.roleId, t.scopeType, t.scopeId).nullsNotDistinct(),
  ],
);

export const device = pgTable(
  'device',
  {
    ...tenant(),
    name: text().notNull(),
    prefix: text().notNull(),
    kind: deviceKind().notNull(),
    ...mutable(),
  },
  (t) => [unique().on(t.schoolId, t.prefix)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    ...tenant(),
    userId: uuid().references(() => userAccount.id),
    deviceId: uuid().references(() => device.id),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: uuid(),
    before: jsonb(),
    after: jsonb(),
    ...created(),
  },
  (t) => [
    index().on(t.schoolId, t.createdAt),
    index().on(t.entity, t.entityId),
    index().on(t.userId, t.createdAt),
  ],
);

export const counter = pgTable(
  'counter',
  {
    ...tenant(),
    key: text().notNull(),
    value: bigint({ mode: 'number' }).notNull().default(0),
    ...mutable(),
  },
  (t) => [unique().on(t.schoolId, t.key)],
);

export const academicYear = pgTable(
  'academic_year',
  {
    ...tenant(),
    label: text().notNull(),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    isCurrent: boolean().notNull().default(false),
    ...mutable(),
  },
  (t) => [
    unique().on(t.schoolId, t.label),
    uniqueIndex('academic_year_one_current')
      .on(t.schoolId)
      .where(sql`is_current`),
  ],
);

export const schoolClass = pgTable(
  'class',
  {
    ...tenant(),
    nameEn: text().notNull(),
    nameUr: text(),
    level: integer().notNull(),
    ...mutable(),
  },
  (t) => [unique().on(t.schoolId, t.level)],
);

export const section = pgTable(
  'section',
  {
    ...tenant(),
    classId: uuid()
      .notNull()
      .references(() => schoolClass.id),
    yearId: uuid()
      .notNull()
      .references(() => academicYear.id),
    name: text().notNull(),
    classTeacherId: uuid().references(() => person.id),
    ...mutable(),
  },
  (t) => [unique().on(t.classId, t.yearId, t.name)],
);

export const guardianStudent = pgTable(
  'guardian_student',
  {
    ...tenant(),
    guardianId: uuid()
      .notNull()
      .references(() => person.id),
    studentId: uuid()
      .notNull()
      .references(() => person.id),
    relation: text().notNull(),
    isPrimary: boolean().notNull().default(false),
    ...mutable(),
  },
  (t) => [unique().on(t.guardianId, t.studentId), index().on(t.studentId)],
);

export const enrollment = pgTable(
  'enrollment',
  {
    ...tenant(),
    studentId: uuid()
      .notNull()
      .references(() => person.id),
    sectionId: uuid()
      .notNull()
      .references(() => section.id),
    yearId: uuid()
      .notNull()
      .references(() => academicYear.id),
    rollNo: integer(),
    admissionNo: text().notNull(),
    joinedOn: date().notNull(),
    leftOn: date(),
    status: enrollmentStatus().notNull().default('active'),
    ...mutable(),
  },
  (t) => [
    // Partial: a promoted student keeps the admission number on the new year's enrollment.
    uniqueIndex('enrollment_admission_no_active')
      .on(t.schoolId, t.admissionNo)
      .where(sql`status = 'active'`),
    index().on(t.sectionId),
    index().on(t.studentId),
  ],
);

export const attendanceEvent = pgTable(
  'attendance_event',
  {
    ...tenant(),
    enrollmentId: uuid()
      .notNull()
      .references(() => enrollment.id),
    date: date().notNull(),
    status: attendanceStatus().notNull(),
    markedBy: uuid()
      .notNull()
      .references(() => userAccount.id),
    deviceId: uuid().references(() => device.id),
    hlc: bigint({ mode: 'number' }).notNull(),
    supersedesId: uuid().references((): AnyPgColumn => attendanceEvent.id),
    ...created(),
  },
  (t) => [index().on(t.enrollmentId, t.date)],
);

export const feeHead = pgTable(
  'fee_head',
  {
    ...tenant(),
    code: text().notNull(),
    nameEn: text().notNull(),
    nameUr: text(),
    priority: integer().notNull(),
    ...mutable(),
  },
  (t) => [unique().on(t.schoolId, t.code)],
);

export const feeStructure = pgTable(
  'fee_structure',
  {
    ...tenant(),
    classId: uuid()
      .notNull()
      .references(() => schoolClass.id),
    yearId: uuid()
      .notNull()
      .references(() => academicYear.id),
    headId: uuid()
      .notNull()
      .references(() => feeHead.id),
    amountPaisa: paisa().notNull(),
    frequency: feeFrequency().notNull(),
    ...mutable(),
  },
  (t) => [unique().on(t.classId, t.yearId, t.headId)],
);

export const studentFeePlan = pgTable(
  'student_fee_plan',
  {
    ...tenant(),
    enrollmentId: uuid()
      .notNull()
      .references(() => enrollment.id),
    headId: uuid()
      .notNull()
      .references(() => feeHead.id),
    discountType: discountType().notNull(),
    // pct: whole percent; fixed: paisa
    value: bigint({ mode: 'number' }).notNull(),
    reason: text(),
    ...mutable(),
  },
  (t) => [unique().on(t.enrollmentId, t.headId)],
);

export const receipt = pgTable(
  'receipt',
  {
    ...tenant(),
    receiptNo: text().notNull(),
    enrollmentId: uuid()
      .notNull()
      .references(() => enrollment.id),
    method: paymentMethod().notNull(),
    totalPaisa: paisa().notNull(),
    receivedBy: uuid()
      .notNull()
      .references(() => userAccount.id),
    deviceId: uuid().references(() => device.id),
    ...created(),
  },
  (t) => [unique().on(t.schoolId, t.receiptNo), index().on(t.enrollmentId)],
);

export const ledgerEntry = pgTable(
  'ledger_entry',
  {
    ...tenant(),
    enrollmentId: uuid()
      .notNull()
      .references(() => enrollment.id),
    headId: uuid()
      .notNull()
      .references(() => feeHead.id),
    period: char({ length: 7 }).notNull(),
    type: ledgerType().notNull(),
    amountPaisa: paisa().notNull(),
    receiptId: uuid().references(() => receipt.id),
    reversesId: uuid()
      .unique()
      .references((): AnyPgColumn => ledgerEntry.id),
    note: text(),
    // Null for system jobs (scheduled charge posting).
    createdBy: uuid().references(() => userAccount.id),
    deviceId: uuid().references(() => device.id),
    hlc: bigint({ mode: 'number' }).notNull(),
    ...created(),
  },
  (t) => [
    uniqueIndex('ledger_entry_one_charge')
      .on(t.enrollmentId, t.headId, t.period)
      .where(sql`type = 'charge'`),
    index().on(t.enrollmentId, t.period),
    index().on(t.receiptId),
  ],
);

export const approvalRequest = pgTable(
  'approval_request',
  {
    ...tenant(),
    action: approvalAction().notNull(),
    requestedBy: uuid()
      .notNull()
      .references(() => userAccount.id),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    status: approvalStatus().notNull().default('pending'),
    decidedBy: uuid().references(() => userAccount.id),
    decidedAt: tz(),
    reason: text(),
    ...mutable(),
  },
  (t) => [index().on(t.schoolId, t.status)],
);

export const cashClose = pgTable(
  'cash_close',
  {
    ...tenant(),
    date: date().notNull(),
    systemTotalPaisa: paisa().notNull(),
    countedTotalPaisa: paisa().notNull(),
    differencePaisa: paisa().notNull(),
    closedBy: uuid()
      .notNull()
      .references(() => userAccount.id),
    ...created(),
  },
  (t) => [unique().on(t.schoolId, t.date)],
);

// connect-pg-simple table layout; managed here so sms_app never needs CREATE.
export const session = pgTable(
  'session',
  {
    sid: varchar().primaryKey(),
    sess: json().notNull(),
    expire: timestamp({ precision: 6 }).notNull(),
  },
  (t) => [index('IDX_session_expire').on(t.expire)],
);

// Created in migration 0001: latest event per (enrollment_id, date) by hlc.
export const attendanceEffective = pgView('attendance_effective', {
  id: uuid('id'),
  schoolId: uuid('school_id'),
  enrollmentId: uuid('enrollment_id'),
  date: date('date'),
  status: attendanceStatus('status'),
  markedBy: uuid('marked_by'),
  deviceId: uuid('device_id'),
  hlc: bigint('hlc', { mode: 'number' }),
  supersedesId: uuid('supersedes_id'),
  createdAt: timestamp('created_at', { withTimezone: true }),
}).existing();
