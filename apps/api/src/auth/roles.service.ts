import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PERMISSION_CODES,
  PRINCIPAL_ONLY,
  PRINCIPAL_ROLE,
  type RoleCreate,
  type RoleItem,
  type RoleUpdate,
} from '@sms/shared';
import { and, asc, count, eq, inArray, isNull, or } from 'drizzle-orm';
import type { Actor } from '../common/actor';
import { AuditService } from '../common/audit.service';
import { DB, type Db } from '../db/database.module';
import { role, rolePermission, userAccount, userRole } from '../db/schema';
import { withTx, type Tx } from '../db/tx';

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });

@Injectable()
export class RolesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async list(schoolId: string): Promise<RoleItem[]> {
    const rows = await this.db
      .select({
        id: role.id,
        code: role.code,
        nameEn: role.nameEn,
        nameUr: role.nameUr,
        schoolId: role.schoolId,
        permission: rolePermission.permissionCode,
      })
      .from(role)
      .leftJoin(rolePermission, eq(rolePermission.roleId, role.id))
      .where(
        and(
          isNull(role.deletedAt),
          or(isNull(role.schoolId), eq(role.schoolId, schoolId)),
        ),
      )
      .orderBy(asc(role.createdAt), asc(role.code));
    const users = await this.db
      .select({ roleId: userRole.roleId, n: count() })
      .from(userRole)
      .innerJoin(userAccount, eq(userAccount.id, userRole.userId))
      .where(
        and(
          eq(userRole.schoolId, schoolId),
          isNull(userRole.deletedAt),
          isNull(userAccount.deletedAt),
        ),
      )
      .groupBy(userRole.roleId);
    const roles = new Map<string, RoleItem>();
    for (const { permission, schoolId: owner, ...r } of rows) {
      const builtIn = owner === null;
      const item = roles.get(r.id) ?? {
        ...r,
        builtIn,
        locked: builtIn && r.code === PRINCIPAL_ROLE,
        permissions: [],
        userCount: users.find((u) => u.roleId === r.id)?.n ?? 0,
      };
      if (permission) item.permissions.push(permission);
      roles.set(r.id, item);
    }
    return [...roles.values()];
  }

  private checkPermissions(codes: string[]) {
    const unknown = codes.filter((c) => !PERMISSION_CODES.includes(c));
    if (unknown.length) {
      throw new BadRequestException({
        code: 'UNKNOWN_PERMISSION',
        message: `Unknown permission: ${unknown.join(', ')}`,
      });
    }
    const reserved = codes.filter((c) => PRINCIPAL_ONLY.includes(c));
    if (reserved.length) {
      throw new BadRequestException({
        code: 'PRINCIPAL_ONLY',
        message: `Only the principal can have: ${reserved.join(', ')}`,
      });
    }
  }

  private async editable(tx: Tx, schoolId: string, id: string) {
    const [row] = await tx
      .select()
      .from(role)
      .where(
        and(
          eq(role.id, id),
          isNull(role.deletedAt),
          or(isNull(role.schoolId), eq(role.schoolId, schoolId)),
        ),
      )
      .for('update');
    if (!row) throw notFound();
    if (row.schoolId === null && row.code === PRINCIPAL_ROLE) {
      throw new BadRequestException({
        code: 'ROLE_LOCKED',
        message: 'The principal role always has every permission',
      });
    }
    return row;
  }

  private async permissionsOf(tx: Tx, roleId: string) {
    const rows = await tx
      .select({ code: rolePermission.permissionCode })
      .from(rolePermission)
      .where(eq(rolePermission.roleId, roleId));
    return rows.map((r) => r.code).sort();
  }

  private async writePermissions(tx: Tx, roleId: string, codes: string[]) {
    await tx.delete(rolePermission).where(eq(rolePermission.roleId, roleId));
    if (codes.length) {
      await tx
        .insert(rolePermission)
        .values(codes.map((permissionCode) => ({ roleId, permissionCode })));
    }
  }

  async create(actor: Actor, input: RoleCreate) {
    const codes = [...new Set(input.permissions)].sort();
    this.checkPermissions(codes);
    return withTx(this.db, async (tx) => {
      const [row] = await tx
        .insert(role)
        .values({
          schoolId: actor.schoolId,
          code: `CUSTOM_${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          nameEn: input.nameEn,
          nameUr: input.nameUr ?? null,
        })
        .returning({ id: role.id });
      await this.writePermissions(tx, row.id, codes);
      await this.audit.record(tx, actor, {
        action: 'role.create',
        entity: 'role',
        entityId: row.id,
        after: { nameEn: input.nameEn, permissions: codes },
      });
      return { id: row.id };
    });
  }

  async update(actor: Actor, id: string, input: RoleUpdate) {
    const codes = [...new Set(input.permissions)].sort();
    this.checkPermissions(codes);
    return withTx(this.db, async (tx) => {
      const row = await this.editable(tx, actor.schoolId, id);
      const before = await this.permissionsOf(tx, id);
      await tx
        .update(role)
        .set({ nameEn: input.nameEn, nameUr: input.nameUr ?? null })
        .where(eq(role.id, id));
      await this.writePermissions(tx, id, codes);
      await this.audit.record(tx, actor, {
        action: 'role.permissions',
        entity: 'role',
        entityId: id,
        before: { nameEn: row.nameEn, permissions: before },
        after: { nameEn: input.nameEn, permissions: codes },
      });
      return { id };
    });
  }

  async remove(actor: Actor, id: string) {
    await withTx(this.db, async (tx) => {
      const row = await this.editable(tx, actor.schoolId, id);
      if (row.schoolId === null) {
        throw new BadRequestException({
          code: 'ROLE_BUILT_IN',
          message: 'Built-in roles cannot be deleted',
        });
      }
      const [inUse] = await tx
        .select({ n: count() })
        .from(userRole)
        .innerJoin(userAccount, eq(userAccount.id, userRole.userId))
        .where(
          and(
            eq(userRole.roleId, id),
            isNull(userRole.deletedAt),
            isNull(userAccount.deletedAt),
          ),
        );
      if (inUse.n > 0) {
        throw new ConflictException({
          code: 'ROLE_IN_USE',
          message: 'Remove this role from its users first',
        });
      }
      const permissions = await this.permissionsOf(tx, id);
      await tx
        .update(role)
        .set({ deletedAt: new Date() })
        .where(eq(role.id, id));
      await tx.delete(rolePermission).where(eq(rolePermission.roleId, id));
      await this.audit.record(tx, actor, {
        action: 'role.delete',
        entity: 'role',
        entityId: id,
        before: { nameEn: row.nameEn, permissions },
      });
    });
  }

  // Used by the users screen: are these ids live roles of this school?
  async known(schoolId: string, ids: string[]) {
    if (ids.length === 0) return new Set<string>();
    const rows = await this.db
      .select({ id: role.id })
      .from(role)
      .where(
        and(
          inArray(role.id, ids),
          isNull(role.deletedAt),
          or(isNull(role.schoolId), eq(role.schoolId, schoolId)),
        ),
      );
    return new Set(rows.map((r) => r.id));
  }
}
