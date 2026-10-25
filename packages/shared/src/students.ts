import { z } from 'zod';
import { pageQuerySchema } from './page';
import { isoDate } from './setup';

const text = (max = 200) => z.string().trim().min(1).max(max);
const optText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullish();

export const genders = ['m', 'f'] as const;
export const enrollmentStatuses = ['active', 'left', 'promoted'] as const;
export type EnrollmentStatus = (typeof enrollmentStatuses)[number];

export const studentFieldsSchema = z.object({
  nameEn: text(),
  nameUr: optText(),
  fatherName: optText(),
  gender: z.enum(genders),
  dob: isoDate.nullish(),
  bForm: optText(20),
  phone: optText(30),
  address: optText(500),
});
export type StudentFields = z.infer<typeof studentFieldsSchema>;

export const guardianInputSchema = z.union([
  z.object({
    guardianId: z.uuid(),
    relation: text(30),
    isPrimary: z.boolean().default(false),
  }),
  z.object({
    nameEn: text(),
    nameUr: optText(),
    phone: optText(30),
    cnic: optText(20),
    relation: text(30),
    isPrimary: z.boolean().default(false),
  }),
]);
export type GuardianInput = z.infer<typeof guardianInputSchema>;

export const admitSchema = z.object({
  student: studentFieldsSchema,
  guardians: z.array(guardianInputSchema).max(4).default([]),
  sectionId: z.uuid(),
  rollNo: z.coerce.number().int().min(1).max(999).nullish(),
  joinedOn: isoDate,
});
export type AdmitInput = z.infer<typeof admitSchema>;

export const studentListQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  classId: z.uuid().optional(),
  sectionId: z.uuid().optional(),
  yearId: z.uuid().optional(),
  status: z.enum(enrollmentStatuses).default('active'),
});
export type StudentListQuery = z.infer<typeof studentListQuerySchema>;

export const leaveSchema = z.object({
  leftOn: isoDate,
  reason: optText(300),
});
export type LeaveInput = z.infer<typeof leaveSchema>;

export const promoteSchema = z.object({
  fromSectionId: z.uuid(),
  toSectionId: z.uuid(),
  studentIds: z.array(z.uuid()).min(1).max(200),
});
export type PromoteInput = z.infer<typeof promoteSchema>;

export interface StudentListItem {
  studentId: string;
  enrollmentId: string;
  admissionNo: string;
  rollNo: number | null;
  nameEn: string;
  nameUr: string | null;
  fatherName: string | null;
  gender: 'm' | 'f' | null;
  phone: string | null;
  classId: string;
  classNameEn: string;
  classNameUr: string | null;
  sectionId: string;
  sectionName: string;
  status: EnrollmentStatus;
}

export interface GuardianView {
  id: string;
  nameEn: string;
  nameUr: string | null;
  phone: string | null;
  cnic: string | null;
  relation: string;
  isPrimary: boolean;
}

export interface EnrollmentView {
  id: string;
  admissionNo: string;
  rollNo: number | null;
  yearLabel: string;
  classNameEn: string;
  classNameUr: string | null;
  sectionId: string;
  sectionName: string;
  joinedOn: string;
  leftOn: string | null;
  status: EnrollmentStatus;
}

export interface StudentDetail extends StudentFields {
  id: string;
  status: 'active' | 'left';
  guardians: GuardianView[];
  enrollments: EnrollmentView[];
}

export interface AdmitResult {
  studentId: string;
  enrollmentId: string;
  admissionNo: string;
}

export const guardianSearchSchema = z.object({
  q: z.string().trim().min(1).max(100),
});

export interface GuardianSearchResult {
  id: string;
  nameEn: string;
  nameUr: string | null;
  phone: string | null;
  cnic: string | null;
  children: string[];
}

export interface PromoteResult {
  promoted: number;
  pendingApprovalId?: string;
  pendingCount: number;
}
