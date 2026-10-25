import { formatPaisa } from '@sms/shared';

type Json = Record<string, unknown> | null;
type Params = Record<string, string | number>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const money = (v: unknown) => (typeof v === 'number' ? formatPaisa(v) : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);

// Template params per action; the web translates `audit.actions.<key>` with them (en/ur JSON).
const PARAMS: Record<string, (after: Json, before: Json) => Params> = {
  'auth.login': () => ({}),
  'auth.logout': () => ({}),
  'auth.login_failed': (a) => ({
    username: str(a?.username),
    reason: str(a?.reason),
  }),
  'auth.switch': () => ({}),
  'auth.pin_failed': (a) => ({ username: str(a?.username) }),
  'student.admit': (a) => ({ name: str(a?.nameEn), no: str(a?.admissionNo) }),
  'student.update': (a) => ({ name: str(a?.nameEn) }),
  'student.leave': (a) => ({ date: str(a?.leftOn) }),
  'guardian.create': (a) => ({ name: str(a?.nameEn) }),
  'enrollment.create': () => ({}),
  'enrollment.promote': () => ({}),
  'attendance.mark': (a) => ({
    date: str(a?.date),
    count: Array.isArray(a?.changes) ? a.changes.length : 0,
  }),
  'fees.payment': (a) => ({
    amount: money(a?.amountPaisa),
    method: str(a?.method),
    no: str(a?.receiptNo),
  }),
  'fees.discount': (a) => ({
    amount: money(a?.amountPaisa),
    period: str(a?.period),
    reason: str(a?.reason),
  }),
  'fees.reverse': (a) => ({ reason: str(a?.reason) }),
  'fees.post_charges': (a) => ({
    count: num(a?.inserted),
    period: str(a?.period),
  }),
  'fees.carry_forward': () => ({}),
  'cash.close': (a) => ({
    date: str(a?.date),
    system: money(a?.systemTotalPaisa),
    counted: money(a?.countedTotalPaisa),
  }),
  'approval.request': (a) => ({ action: str(a?.action) }),
  'approval.approve': (a) => ({ action: str(a?.action) }),
  'approval.reject': (a) => ({
    action: str(a?.action),
    reason: str(a?.reason),
  }),
  'school.update': (a) => ({ name: str(a?.nameEn) }),
  'settings.update': (a, b) => ({
    fromDays: num(b?.attendanceLockDays),
    toDays: num(a?.attendanceLockDays),
    fromLimit: money(b?.discountThresholdPaisa),
    toLimit: money(a?.discountThresholdPaisa),
  }),
  'user.create': (a) => ({ username: str(a?.username) }),
  'user.update': (a) => ({ name: str(a?.nameEn) }),
  'user.enable': (a) => ({ name: str(a?.nameEn) }),
  'user.disable': (a) => ({ name: str(a?.nameEn) }),
  'user.roles': () => ({}),
  'user.reset': (a) => ({
    what: [a?.password && 'password', a?.pin && 'PIN']
      .filter(Boolean)
      .join(' + '),
  }),
  'user.delete': (_, b) => ({ username: str(b?.username) }),
};

// English templates (same text as audit.actions.* in apps/web/src/locales/en.json).
export const AUDIT_EN: Record<string, string> = {
  'auth.login': 'Logged in',
  'auth.logout': 'Logged out',
  'auth.login_failed': 'Failed login for "{{username}}" ({{reason}})',
  'auth.switch': 'Switched user with PIN',
  'auth.pin_failed': 'Wrong PIN for "{{username}}"',
  'student.admit': 'Admitted {{name}} ({{no}})',
  'student.update': 'Edited student {{name}}',
  'student.leave': 'Marked student as left from {{date}}',
  'guardian.create': 'Added guardian {{name}}',
  'enrollment.create': 'Enrolled student in a section',
  'enrollment.promote': 'Promoted student',
  'attendance.mark': 'Attendance {{date}}: {{count}} change(s)',
  'fees.payment': 'Payment {{amount}} ({{method}}), receipt {{no}}',
  'fees.discount': 'Discount {{amount}} for {{period}}: {{reason}}',
  'fees.reverse': 'Cancelled receipt: {{reason}}',
  'fees.post_charges': 'Posted {{count}} charges for {{period}}',
  'fees.carry_forward': 'Carried unpaid fees to the new class',
  'cash.close':
    'Closed cash for {{date}}: system {{system}}, counted {{counted}}',
  'approval.request': 'Requested approval: {{action}}',
  'approval.approve': 'Approved {{action}}',
  'approval.reject': 'Rejected {{action}}: {{reason}}',
  'school.update': 'Edited school details ({{name}})',
  'settings.update':
    'Settings: lock days {{fromDays}} → {{toDays}}, discount limit {{fromLimit}} → {{toLimit}}',
  'user.create': 'Created user "{{username}}"',
  'user.update': 'Edited user {{name}}',
  'user.enable': 'Enabled user {{name}}',
  'user.disable': 'Disabled user {{name}} (logged out)',
  'user.roles': 'Changed user roles',
  'user.reset': 'Reset {{what}}',
  'user.delete': 'Deleted user "{{username}}"',
  other: '{{action}} on {{entity}}',
};

const fill = (template: string, params: Params) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params[k] ?? ''));

// key + params for the UI to translate, and the English line as a fallback.
export function auditSummary(
  action: string,
  entity: string,
  before: unknown,
  after: unknown,
) {
  const build = PARAMS[action] as
    ((after: Json, before: Json) => Params) | undefined;
  const key = build ? action : 'other';
  const params = build
    ? build(after as Json, before as Json)
    : { action, entity };
  return { key, params, text: fill(AUDIT_EN[key], params) };
}
