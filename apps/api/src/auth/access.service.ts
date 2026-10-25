import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/database.module';
import {
  person,
  role,
  rolePermission,
  userAccount,
  userRole,
} from '../db/schema';

interface Grant {
  code: string | null;
  roleCode: string;
  scopeType: 'school' | 'section';
  scopeId: string | null;
}

export class UserAccess {
  constructor(
    readonly user: { id: string; username: string; schoolId: string },
    private readonly grants: Grant[],
  ) {}

  get roles(): string[] {
    return [...new Set(this.grants.map((g) => g.roleCode))];
  }

  get permissions(): string[] {
    return [
      ...new Set(this.grants.flatMap((g) => (g.code ? [g.code] : []))),
    ].sort();
  }

  can(code: string, sectionId?: string): boolean {
    return this.grants.some(
      (g) =>
        g.code === code &&
        ((g.scopeType === 'school' &&
          (g.scopeId === null || g.scopeId === this.user.schoolId)) ||
          (g.scopeType === 'section' &&
            sectionId !== undefined &&
            g.scopeId === sectionId)),
    );
  }
}

@Injectable()
export class AccessService {
  constructor(@Inject(DB) private readonly db: Db) {}

  // Null when the account is missing, deleted or disabled.
  async load(userId: string): Promise<UserAccess | null> {
    const [user] = await this.db
      .select({
        id: userAccount.id,
        username: userAccount.username,
        schoolId: userAccount.schoolId,
      })
      .from(userAccount)
      .where(
        and(
          eq(userAccount.id, userId),
          eq(userAccount.isActive, true),
          isNull(userAccount.deletedAt),
        ),
      );
    if (!user) return null;

    const grants = await this.db
      .select({
        code: rolePermission.permissionCode,
        roleCode: role.code,
        scopeType: userRole.scopeType,
        scopeId: userRole.scopeId,
      })
      .from(userRole)
      .innerJoin(
        role,
        and(
          eq(role.id, userRole.roleId),
          isNull(role.deletedAt),
          or(isNull(role.schoolId), eq(role.schoolId, user.schoolId)),
        ),
      )
      .leftJoin(rolePermission, eq(rolePermission.roleId, role.id))
      .where(
        and(
          eq(userRole.userId, userId),
          isNull(userRole.deletedAt),
          lte(userRole.validFrom, sql`current_date`),
          or(
            isNull(userRole.validTo),
            gte(userRole.validTo, sql`current_date`),
          ),
        ),
      );
    return new UserAccess(user, grants);
  }

  async displayNames(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, string>();
    const rows = await this.db
      .select({ id: userAccount.id, name: person.nameEn })
      .from(userAccount)
      .innerJoin(person, eq(person.id, userAccount.personId))
      .where(inArray(userAccount.id, userIds));
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}
