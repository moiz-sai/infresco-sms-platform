import { z } from 'zod';
import { pageQuerySchema } from './page';

export const approvalStatuses = ['pending', 'approved', 'rejected'] as const;

export const approvalListQuerySchema = pageQuerySchema.extend({
  status: z.enum(approvalStatuses).optional(),
});
export type ApprovalListQuery = z.infer<typeof approvalListQuerySchema>;
