import { z } from 'zod';
import { pageQuerySchema } from './page';
import { isoDate } from './setup';
import type { AttendanceStatus } from './attendance';
import type { PaymentMethod } from './fees';

// ---------- dashboard

export interface ClassRate {
  classId: string;
  classNameEn: string;
  classNameUr: string | null;
  // null when there is nothing to measure (no dues / nobody marked)
  pct: number | null;
}

export interface EnrollmentSummary {
  total: number;
  boys: number;
  girls: number;
  genderUnset: number;
  joinedThisMonth: number;
  leftThisMonth: number;
  classes: {
    classId: string;
    classNameEn: string;
    classNameUr: string | null;
    total: number;
    sections: { sectionId: string; name: string; total: number }[];
  }[];
}

export interface Absentee {
  enrollmentId: string;
  studentId: string;
  nameEn: string;
  nameUr: string | null;
  classNameEn: string;
  classNameUr: string | null;
  sectionName: string;
}

export interface Dashboard {
  date: string;
  period: string;
  todayCollection: { method: PaymentMethod; totalPaisa: number; count: number }[];
  month: { collectedPaisa: number; expectedPaisa: number };
  collectionByClass: ClassRate[];
  attendanceByClass: ClassRate[];
  // School-wide % per day over the last 30 days (days nobody marked are left out)
  attendanceTrend: { date: string; pct: number }[];
  absentees: Absentee[];
  defaulters: { count: number; totalPaisa: number };
  pendingApprovals: number;
  lastCashClose: { date: string; differencePaisa: number } | null;
  enrollment: EnrollmentSummary;
}

// Present share of marked students; vacation days are not counted.
export function attendancePct(counts: Partial<Record<AttendanceStatus, number>>) {
  const p = counts.P ?? 0;
  const base = p + (counts.A ?? 0) + (counts.L ?? 0);
  return base === 0 ? null : Math.round((p * 1000) / base) / 10;
}

// ---------- defaulters

export const defaulterQuerySchema = pageQuerySchema.extend({
  classId: z.uuid().optional(),
  minMonths: z.coerce.number().int().min(1).max(24).default(1),
  size: z.coerce.number().int().min(1).max(100).default(100),
});
export type DefaulterQuery = z.infer<typeof defaulterQuerySchema>;

export interface Defaulter {
  enrollmentId: string;
  studentId: string;
  admissionNo: string;
  nameEn: string;
  nameUr: string | null;
  fatherName: string | null;
  classNameEn: string;
  classNameUr: string | null;
  sectionName: string;
  months: number;
  oldestPeriod: string;
  balancePaisa: number;
}

// ---------- student attendance summary (SPEC §Z4)

export interface AttendanceSummary {
  enrollmentId: string;
  from: string;
  to: string;
  pct: number | null;
  counts: Record<AttendanceStatus, number>;
  months: { month: string; pct: number | null; counts: Record<AttendanceStatus, number> }[];
}

// ---------- users

const pin = z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits');
const password = z.string().min(8, 'At least 8 characters').max(256);
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, '3–32 letters, digits, dot, dash or underscore');

export const userCreateSchema = z.object({
  username,
  nameEn: z.string().trim().min(1).max(200),
  nameUr: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null)
    .nullish(),
  password,
  pin,
  roleIds: z.array(z.uuid()).min(1, 'Pick at least one role'),
});
export type UserCreate = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = userCreateSchema
  .pick({ nameEn: true, nameUr: true })
  .extend({ isActive: z.boolean() });
export type UserUpdate = z.infer<typeof userUpdateSchema>;

export const userRolesSchema = z.object({ roleIds: z.array(z.uuid()).min(1, 'Pick at least one role') });
export type UserRolesInput = z.infer<typeof userRolesSchema>;

export const userResetSchema = z
  .object({ password: password.optional(), pin: pin.optional() })
  .refine((v) => v.password || v.pin, { message: 'Give a new password or PIN' });
export type UserReset = z.infer<typeof userResetSchema>;

export interface RoleItem {
  id: string;
  code: string;
  nameEn: string;
  nameUr: string | null;
  permissions: string[];
}

export interface UserItem {
  id: string;
  username: string;
  nameEn: string;
  nameUr: string | null;
  isActive: boolean;
  locked: boolean;
  roles: { id: string; code: string; nameEn: string; nameUr: string | null }[];
  createdAt: string;
}

// ---------- audit

export const auditQuerySchema = pageQuerySchema.extend({
  userId: z.uuid().optional(),
  entity: z.string().trim().max(50).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  size: z.coerce.number().int().min(1).max(100).default(50),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditItem {
  id: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  before: unknown;
  after: unknown;
}

// ---------- settings

export const settingsSchema = z.object({
  attendanceLockDays: z.coerce.number().int().min(0).max(60),
  discountThresholdPaisa: z.coerce.number().int().min(0).max(100_000_000),
  allocation: z.literal('oldest_first').default('oldest_first'),
});
export type SettingsInput = z.infer<typeof settingsSchema>;
