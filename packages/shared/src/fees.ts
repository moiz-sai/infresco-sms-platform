import { z } from 'zod';

export const feeFrequencies = ['monthly', 'yearly', 'once'] as const;
export const paymentMethods = ['cash', 'bank', 'online'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export const discountTypes = ['pct', 'fixed'] as const;
export const ledgerTypes = ['charge', 'payment', 'adjust', 'reversal'] as const;
export type LedgerType = (typeof ledgerTypes)[number];

export const ADVANCE_HEAD = 'ADV';
const MAX_PAISA = 100_000_000_00; // Rs 10 crore

export const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Period must be YYYY-MM');
const paisa = z.coerce.number().int().min(0).max(MAX_PAISA);

export const feeHeadSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, '2–6 letters/digits'),
  nameEn: z.string().trim().min(1).max(60),
  nameUr: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v || null)
    .nullish(),
  priority: z.coerce.number().int().min(0).max(998),
});
export type FeeHeadInput = z.infer<typeof feeHeadSchema>;

export const feeStructureSchema = z.object({
  classId: z.uuid(),
  yearId: z.uuid(),
  headId: z.uuid(),
  amountPaisa: paisa,
  frequency: z.enum(feeFrequencies),
});
export type FeeStructureInput = z.infer<typeof feeStructureSchema>;

export const feeStructureQuerySchema = z.object({
  yearId: z.uuid().optional(),
});

export const feePlanSchema = z
  .object({
    enrollmentId: z.uuid(),
    headId: z.uuid(),
    discountType: z.enum(discountTypes),
    value: paisa,
    reason: z
      .string()
      .trim()
      .max(300)
      .transform((v) => v || null)
      .nullish(),
  })
  .refine((p) => p.discountType !== 'pct' || p.value <= 100, {
    message: 'Percent must be 0–100',
    path: ['value'],
  });
export type FeePlanInput = z.infer<typeof feePlanSchema>;

export const feePlanQuerySchema = z.object({ enrollmentId: z.uuid() });

export const postChargesSchema = z.object({ period: periodSchema });

export const paymentSchema = z.object({
  enrollmentId: z.uuid(),
  amountPaisa: z.coerce.number().int().min(1).max(MAX_PAISA),
  method: z.enum(paymentMethods).default('cash'),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export interface FeeHead {
  id: string;
  code: string;
  nameEn: string;
  nameUr: string | null;
  priority: number;
}

export interface FeeStructure extends FeeStructureInput {
  id: string;
}

export interface FeePlan {
  id: string;
  enrollmentId: string;
  headId: string;
  discountType: (typeof discountTypes)[number];
  value: number;
  reason: string | null;
}

export interface PostChargesResult {
  period: string;
  inserted: number;
}

export interface StatementEntry {
  id: string;
  createdAt: string;
  period: string;
  headCode: string;
  headNameEn: string;
  headNameUr: string | null;
  type: LedgerType;
  amountPaisa: number;
  receiptId: string | null;
  receiptNo: string | null;
  note: string | null;
  balancePaisa: number;
}

export interface DueLine {
  period: string;
  headId: string;
  headCode: string;
  headNameEn: string;
  headNameUr: string | null;
  amountPaisa: number;
}

export interface FeeStudent {
  enrollmentId: string;
  studentId: string;
  admissionNo: string;
  nameEn: string;
  nameUr: string | null;
  fatherName: string | null;
  classNameEn: string;
  classNameUr: string | null;
  sectionName: string;
  status: string;
}

export interface Statement {
  student: FeeStudent;
  entries: StatementEntry[];
  dues: DueLine[];
  balancePaisa: number;
  advancePaisa: number;
  siblings: (FeeStudent & { balancePaisa: number })[];
}

export interface ReceiptLine {
  period: string;
  headCode: string;
  headNameEn: string;
  headNameUr: string | null;
  amountPaisa: number;
}

export interface ReceiptView {
  id: string;
  receiptNo: string;
  createdAt: string;
  method: PaymentMethod;
  totalPaisa: number;
  receivedBy: string;
  cancelled: boolean;
  balanceAfterPaisa: number;
  school: {
    nameEn: string;
    nameUr: string | null;
    address: string | null;
    phone: string | null;
  };
  student: FeeStudent;
  lines: ReceiptLine[];
}

// "Rs 3,000" — paisa shown only when present.
export function formatPaisa(paisa: number): string {
  const sign = paisa < 0 ? '-' : '';
  const abs = Math.abs(paisa);
  const rupees = Math.floor(abs / 100).toLocaleString('en-US');
  const rest = abs % 100;
  return `${sign}Rs ${rupees}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}

const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} hundred` : '', r ? belowHundred(r) : '']
    .filter(Boolean)
    .join(' ');
}

// Pakistani numbering (thousand, lakh, crore), as printed on receipts.
function rupeesInWords(n: number): string {
  if (n === 0) return 'zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${rupeesInWords(crore)} crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

export function amountInWords(paisa: number): string {
  const rupees = Math.floor(Math.abs(paisa) / 100);
  const p = Math.abs(paisa) % 100;
  const words = `${rupeesInWords(rupees)} rupees${p ? ` and ${belowHundred(p)} paisa` : ''} only`;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Urdu number words 0–99 are irregular, so they are listed whole.
const UR_0_99 = (
  'صفر ایک دو تین چار پانچ چھ سات آٹھ نو دس گیارہ بارہ تیرہ چودہ پندرہ سولہ سترہ اٹھارہ انیس ' +
  'بیس اکیس بائیس تیئیس چوبیس پچیس چھبیس ستائیس اٹھائیس انتیس تیس اکتیس بتیس تینتیس چونتیس ' +
  'پینتیس چھتیس سینتیس اڑتیس انتالیس چالیس اکتالیس بیالیس تینتالیس چوالیس پینتالیس چھیالیس ' +
  'سینتالیس اڑتالیس انچاس پچاس اکاون باون ترپن چون پچپن چھپن ستاون اٹھاون انسٹھ ساٹھ اکسٹھ ' +
  'باسٹھ ترسٹھ چونسٹھ پینسٹھ چھیاسٹھ سڑسٹھ اڑسٹھ انہتر ستر اکہتر بہتر تہتر چوہتر پچھتر ' +
  'چھہتر ستتر اٹھہتر اناسی اسی اکیاسی بیاسی تراسی چوراسی پچاسی چھیاسی ستاسی اٹھاسی نواسی ' +
  'نوے اکیانوے بانوے ترانوے چورانوے پچانوے چھیانوے ستانوے اٹھانوے ننانوے'
).split(' ');

function rupeesInWordsUr(n: number): string {
  if (n === 0) return UR_0_99[0];
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (crore) parts.push(`${rupeesInWordsUr(crore)} کروڑ`);
  if (lakh) parts.push(`${UR_0_99[lakh]} لاکھ`);
  if (thousand) parts.push(`${UR_0_99[thousand]} ہزار`);
  if (hundred) parts.push(`${UR_0_99[hundred]} سو`);
  if (rest) parts.push(UR_0_99[rest]);
  return parts.join(' ');
}

export function amountInWordsUr(paisa: number): string {
  const rupees = Math.floor(Math.abs(paisa) / 100);
  const p = Math.abs(paisa) % 100;
  return `${rupeesInWordsUr(rupees)} روپے${p ? ` اور ${UR_0_99[p]} پیسے` : ''} صرف`;
}

export const discountSchema = z.object({
  enrollmentId: z.uuid(),
  headId: z.uuid(),
  period: periodSchema,
  amountPaisa: z.coerce.number().int().min(1).max(MAX_PAISA),
  reason: z.string().trim().min(1).max(300),
});
export type DiscountInput = z.infer<typeof discountSchema>;

export const reverseSchema = z.object({
  reason: z.string().trim().min(1).max(300),
});

export const cashCloseSchema = z.object({
  countedTotalPaisa: z.coerce.number().int().min(0).max(MAX_PAISA),
});

// Result of an action that may need the principal: applied now, or waiting in the inbox.
export interface ApprovalOutcome {
  applied: boolean;
  pendingApprovalId?: string;
}

export interface CashCloseView {
  date: string;
  systemTotalPaisa: number;
  receiptCount: number;
  close: {
    countedTotalPaisa: number;
    differencePaisa: number;
    closedByName: string;
    createdAt: string;
  } | null;
}
