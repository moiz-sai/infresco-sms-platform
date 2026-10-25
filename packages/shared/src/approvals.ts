import { z } from 'zod';
import { pageQuerySchema } from './page';

export const approvalStatuses = ['pending', 'approved', 'rejected'] as const;
export const approvalActions = [
  'fees.discount',
  'fees.reverse',
  'attendance.edit_old',
  'students.promote',
] as const;
export type ApprovalActionName = (typeof approvalActions)[number];

export const approvalListQuerySchema = pageQuerySchema.extend({
  status: z.enum(approvalStatuses).optional(),
});
export type ApprovalListQuery = z.infer<typeof approvalListQuerySchema>;

export const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(300),
});

// Shown in the inbox; captured when the request is made so the list needs no lookups.
export interface ApprovalDisplay {
  studentNameEn?: string;
  studentNameUr?: string | null;
  admissionNo?: string;
  sectionName?: string;
  amountPaisa?: number;
  receiptNo?: string;
  headCode?: string;
  period?: string;
  date?: string;
  count?: number;
  reason?: string | null;
  kind?: 'adjust' | 'plan';
  fromSection?: string;
  toSection?: string;
  students?: {
    nameEn: string;
    nameUr: string | null;
    admissionNo: string;
    balancePaisa: number;
  }[];
}

export interface ApprovalItem {
  id: string;
  action: ApprovalActionName;
  status: (typeof approvalStatuses)[number];
  payload: { display?: ApprovalDisplay } & Record<string, unknown>;
  requestedBy: string;
  requestedByName: string;
  createdAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
  reason: string | null;
}
