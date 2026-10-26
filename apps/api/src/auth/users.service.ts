import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import type { UserCreate, UserItem, UserReset, UserUpdate } from '@sms/shared';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Actor } from '../common/actor';
import { AuditService } from '../common/audit.service';
import { DB, type Db } from '../db/database.module';
import { person, role, userAccount, userRole } from '../db/schema';
import { withTx, type Tx } from '../db/tx';
import { RolesService } from './roles.service';

type UserActor = Actor & { userId: string };

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
const notSelf = (what: string) =>
  new ConflictException({
    code: 'SELF',
    message: `You cannot ${what} your own account`,
  });

// Ends every session of a user at once (connect-pg-simple keeps the user id in sess json).
const killSessions = (tx: Tx, userId: string) =>
  tx.execute(sql`delete from session where sess->>'userId' = ${userId}`);

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly roles: RolesService,
  ) {}

  async list(schoolId: string): Promise<UserItem[]> {
    const users = await this.db
      .select({
        id: userAccount.id,
        username: userAccount.username,
        nameEn: person.nameEn,
        nameUr: person.nameUr,
        isActive: userAccount.isActive,
        lockedUntil: userAccount.lockedUntil,
        createdAt: userAccount.createdAt,
      })
      .from(userAccount)
      .innerJoin(person, eq(person.id, userAccount.personId))
      .where(
        and(eq(userAccount.schoolId, schoolId), isNull(userAccount.deletedAt)),
      )
      .orderBy(asc(userAccount.username));
    const grants = users.length
      ? await this.db
          .select({
            userId: userRole.userId,
            id: role.id,
            code: role.code,
            nameEn: role.nameEn,
            nameUr: role.nameUr,
          })
          .from(userRole)
          .innerJoin(role, eq(role.id, userRole.roleId))
          .where(
            and(
              inArray(
                userRole.userId,
                users.map((u) => u.id),
              ),
              isNull(userRole.deletedAt),
            ),
          )
      : [];
    const now = new Date();
    return users.map(({ lockedUntil, createdAt, ...u }) => ({
      ...u,
      locked: !!lockedUntil && lockedUntil > now,
      createdAt: createdAt.toISOString(),
      roles: grants
        .filter((g) => g.userId === u.id)
        .map((g) => ({
          id: g.id,
          code: g.code,
          nameEn: g.nameEn,
          nameUr: g.nameUr,
        })),
    }));
  }

  private async checkRoles(schoolId: string, roleIds: string[]) {
    const known = await this.roles.known(schoolId, roleIds);
    const unknown = roleIds.filter((id) => !known.has(id));
    if (unknown.length) {
      throw new BadRequestException({
        code: 'UNKNOWN_ROLE',
        message: `Unknown role: ${unknown.join(', ')}`,
      });
    }
  }

  private async lockUser(tx: Tx, schoolId: string, id: string) {
    const [row] = await tx
      .select()
      .from(userAccount)
      .where(
        and(
          eq(userAccount.id, id),
          eq(userAccount.schoolId, schoolId),
          isNull(userAccount.deletedAt),
        ),
      )
      .for('update');
    if (!row) throw notFound();
    return row;
  }

  // Grants are school-wide; removed roles are soft-deleted, re-added ones revived.
  private async writeRoles(
    tx: Tx,
    schoolId: string,
    userId: string,
    roleIds: string[],
  ) {
    await tx
      .update(userRole)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(userRole.userId, userId),
          isNull(userRole.deletedAt),
          sql`${userRole.roleId} not in (${sql.join(
            roleIds.map((r) => sql`${r}::uuid`),
            sql`, `,
          )})`,
        ),
      );
    await tx
      .insert(userRole)
      .values(
        roleIds.map((roleId) => ({
          schoolId,
          userId,
          roleId,
          scopeType: 'school' as const,
          scopeId: schoolId,
        })),
      )
      .onConflictDoUpdate({
        target: [
          userRole.userId,
          userRole.roleId,
          userRole.scopeType,
          userRole.scopeId,
        ],
        set: { deletedAt: null, validTo: null },
      });
  }

  async create(actor: UserActor, input: UserCreate) {
    await this.checkRoles(actor.schoolId, input.roleIds);
    const [passwordHash, pinHash] = await Promise.all([
      hash(input.password),
      hash(input.pin),
    ]);
    return withTx(this.db, async (tx) => {
      const [p] = await tx
        .insert(person)
        .values({
          schoolId: actor.schoolId,
          kind: 'staff',
          nameEn: input.nameEn,
          nameUr: input.nameUr ?? null,
          searchText: input.nameEn.toLowerCase(),
        })
        .returning({ id: person.id });
      const [account] = await tx
        .insert(userAccount)
        .values({
          schoolId: actor.schoolId,
          personId: p.id,
          username: input.username,
          passwordHash,
          pinHash,
        })
        .returning({ id: userAccount.id });
      await this.writeRoles(tx, actor.schoolId, account.id, input.roleIds);
      await this.audit.record(tx, actor, {
        action: 'user.create',
        entity: 'user_account',
        entityId: account.id,
        after: {
          username: input.username,
          nameEn: input.nameEn,
          roleIds: input.roleIds,
        },
      });
      return { id: account.id };
    });
  }

  async update(actor: UserActor, id: string, input: UserUpdate) {
    if (id === actor.userId && !input.isActive) throw notSelf('disable');
    return withTx(this.db, async (tx) => {
      const user = await this.lockUser(tx, actor.schoolId, id);
      const [before] = await tx
        .select({ nameEn: person.nameEn, nameUr: person.nameUr })
        .from(person)
        .where(eq(person.id, user.personId));
      await tx
        .update(person)
        .set({
          nameEn: input.nameEn,
          nameUr: input.nameUr ?? null,
          searchText: input.nameEn.toLowerCase(),
        })
        .where(eq(person.id, user.personId));
      await tx
        .update(userAccount)
        .set({ isActive: input.isActive })
        .where(eq(userAccount.id, id));
      if (!input.isActive) await killSessions(tx, id);
      await this.audit.record(tx, actor, {
        action:
          input.isActive === user.isActive
            ? 'user.update'
            : input.isActive
              ? 'user.enable'
              : 'user.disable',
        entity: 'user_account',
        entityId: id,
        before: { ...before, isActive: user.isActive },
        after: input,
      });
      return { id };
    });
  }

  async setRoles(actor: UserActor, id: string, roleIds: string[]) {
    await this.checkRoles(actor.schoolId, roleIds);
    if (id === actor.userId) {
      const roles = await this.roles.list(actor.schoolId);
      const keepsManage = roles.some(
        (r) => roleIds.includes(r.id) && r.permissions.includes('users.manage'),
      );
      if (!keepsManage) throw notSelf('remove user management from');
    }
    return withTx(this.db, async (tx) => {
      await this.lockUser(tx, actor.schoolId, id);
      await this.writeRoles(tx, actor.schoolId, id, roleIds);
      await this.audit.record(tx, actor, {
        action: 'user.roles',
        entity: 'user_account',
        entityId: id,
        after: { roleIds },
      });
      return { id };
    });
  }

  async reset(actor: UserActor, id: string, input: UserReset) {
    const [passwordHash, pinHash] = await Promise.all([
      input.password ? hash(input.password) : undefined,
      input.pin ? hash(input.pin) : undefined,
    ]);
    return withTx(this.db, async (tx) => {
      await this.lockUser(tx, actor.schoolId, id);
      await tx
        .update(userAccount)
        .set({ passwordHash, pinHash, failedCount: 0, lockedUntil: null })
        .where(eq(userAccount.id, id));
      await this.audit.record(tx, actor, {
        action: 'user.reset',
        entity: 'user_account',
        entityId: id,
        after: { password: !!input.password, pin: !!input.pin },
      });
      return { id };
    });
  }

  // Soft delete: the username stays taken so audit history keeps pointing at one account.
  async remove(actor: UserActor, id: string) {
    if (id === actor.userId) throw notSelf('delete');
    await withTx(this.db, async (tx) => {
      const user = await this.lockUser(tx, actor.schoolId, id);
      await tx
        .update(userAccount)
        .set({ isActive: false, deletedAt: new Date() })
        .where(eq(userAccount.id, id));
      await killSessions(tx, id);
      await this.audit.record(tx, actor, {
        action: 'user.delete',
        entity: 'user_account',
        entityId: id,
        before: { username: user.username },
      });
    });
  }
}
