import { formatPaisa } from '@sms/shared';

type Json = Record<string, unknown> | null;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const money = (v: unknown) => (typeof v === 'number' ? formatPaisa(v) : '');

const LABELS: Record<string, (after: Json, before: Json) => string> = {
  'auth.login': () => 'Logged in',
  'auth.logout': () => 'Logged out',
  'auth.login_failed': (a) =>
    `Failed login for "${str(a?.username)}" (${str(a?.reason)})`,
  'auth.switch': () => 'Switched user with PIN',
  'auth.pin_failed': (a) => `Wrong PIN for "${str(a?.username)}"`,
  'student.admit': (a) => `Admitted ${str(a?.nameEn)} (${str(a?.admissionNo)})`,
  'student.update': (a) => `Edited student ${str(a?.nameEn)}`,
  'student.leave': (a) => `Marked student as left from ${str(a?.leftOn)}`,
  'guardian.create': (a) => `Added guardian ${str(a?.nameEn)}`,
  'enrollment.create': () => 'Enrolled student in a section',
  'enrollment.promote': () => 'Promoted student',
  'attendance.mark': (a) =>
    `Attendance ${str(a?.date)}: ${Array.isArray(a?.changes) ? a.changes.length : 0} change(s)`,
  'fees.payment': (a) =>
    `Payment ${money(a?.amountPaisa)} (${str(a?.method)}), receipt ${str(a?.receiptNo)}`,
  'fees.discount': (a) =>
    `Discount ${money(a?.amountPaisa)} for ${str(a?.period)}: ${str(a?.reason)}`,
  'fees.reverse': (a) => `Cancelled receipt: ${str(a?.reason)}`,
  'fees.post_charges': (a) =>
    `Posted ${typeof a?.inserted === 'number' ? a.inserted : 0} charges for ${str(a?.period)}`,
  'fees.carry_forward': () => 'Carried unpaid fees to the new class',
  'cash.close': (a) =>
    `Closed cash for ${str(a?.date)}: system ${money(a?.systemTotalPaisa)}, counted ${money(a?.countedTotalPaisa)}`,
  'approval.request': (a) => `Requested approval: ${str(a?.action)}`,
  'approval.approve': (a) => `Approved ${str(a?.action)}`,
  'approval.reject': (a) => `Rejected ${str(a?.action)}: ${str(a?.reason)}`,
  'school.update': (a) => `Edited school details (${str(a?.nameEn)})`,
  'settings.update': (a, b) =>
    `Settings: lock days ${String(b?.attendanceLockDays)} → ${String(a?.attendanceLockDays)}, discount limit ${money(b?.discountThresholdPaisa)} → ${money(a?.discountThresholdPaisa)}`,
  'user.create': (a) => `Created user "${str(a?.username)}"`,
  'user.update': (a) => `Edited user ${str(a?.nameEn)}`,
  'user.enable': (a) => `Enabled user ${str(a?.nameEn)}`,
  'user.disable': (a) => `Disabled user ${str(a?.nameEn)} (logged out)`,
  'user.roles': () => 'Changed user roles',
  'user.reset': (a) =>
    `Reset ${[a?.password && 'password', a?.pin && 'PIN'].filter(Boolean).join(' and ')}`,
  'user.delete': (_, b) => `Deleted user "${str(b?.username)}"`,
};

const words = (s: string) => s.replace(/[._]/g, ' ');

// One readable English line per audit entry; unknown actions fall back to "action on entity".
export function auditSummary(
  action: string,
  entity: string,
  before: unknown,
  after: unknown,
) {
  const label = LABELS[action];
  if (label) return label(after as Json, before as Json);
  const [, verb] = action.split('.');
  return `${words(verb ?? action)} ${words(entity)}`.replace(/^./, (c) =>
    c.toUpperCase(),
  );
}
