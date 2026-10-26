import { z } from 'zod';

// Single list of permission codes, grouped by module (SPEC §5, §T12). The order here is the order
// of the Roles grid. Modules marked `licensed` can be switched off by the license (§T13).
export const PERMISSION_MODULES = [
  { module: 'dashboard', codes: ['dashboard.view'] },
  {
    module: 'students',
    codes: ['students.view', 'students.edit', 'students.promote'],
  },
  { module: 'attendance', codes: ['attendance.view', 'attendance.mark'] },
  {
    module: 'fees',
    codes: [
      'fees.collect',
      'fees.discount',
      'fees.reverse.request',
      'fees.defaulters',
      'fees.cash_close',
      'fees.configure',
    ],
  },
  { module: 'approvals', codes: ['approvals.decide'] },
  { module: 'setup', codes: ['setup.manage', 'settings.manage'] },
  { module: 'users', codes: ['users.manage', 'roles.manage'] },
  { module: 'audit', codes: ['audit.view'] },
] as const satisfies readonly {
  module: string;
  codes: readonly string[];
  licensed?: boolean;
}[];

export type PermissionModule = (typeof PERMISSION_MODULES)[number]['module'];
export type PermissionCode =
  (typeof PERMISSION_MODULES)[number]['codes'][number];

export const PERMISSION_CODES: string[] = PERMISSION_MODULES.flatMap((m) => [
  ...m.codes,
]);

export const moduleOf = (code: string): string | undefined =>
  PERMISSION_MODULES.find((m) => (m.codes as readonly string[]).includes(code))
    ?.module;

// Never granted to any role but Principal.
export const PRINCIPAL_ONLY: string[] = ['roles.manage'];

// A new permission code reaches the built-in Clerk role on the next seed unless listed here.
export const CLERK_DEFAULT_EXCLUDED: string[] = [
  'approvals.decide',
  'setup.manage',
  'settings.manage',
  'users.manage',
  'roles.manage',
  'audit.view',
];

export const PRINCIPAL_ROLE = 'PRINCIPAL';

export interface RoleItem {
  id: string;
  code: string;
  nameEn: string;
  nameUr: string | null;
  permissions: string[];
  builtIn: boolean;
  // Principal: always every permission, cannot be edited
  locked: boolean;
  userCount: number;
}

const roleName = {
  nameEn: z.string().trim().min(1, 'Required').max(60),
  nameUr: z.string().trim().max(60).nullish(),
};

export const roleCreateSchema = z.object({
  ...roleName,
  permissions: z.array(z.string()).default([]),
});
export type RoleCreate = z.infer<typeof roleCreateSchema>;

export const roleUpdateSchema = z.object({
  ...roleName,
  permissions: z.array(z.string()),
});
export type RoleUpdate = z.infer<typeof roleUpdateSchema>;
