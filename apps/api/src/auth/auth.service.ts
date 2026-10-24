import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verify } from '@node-rs/argon2';
import type { LoginInput, Me, SwitchUserInput } from '@sms/shared';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import type { Request } from 'express';
import type { Actor } from '../common/actor';
import { AuditService } from '../common/audit.service';
import { SchoolContextService } from '../common/school-context.service';
import { DB, type Db } from '../db/database.module';
import { auditLog, person, userAccount } from '../db/schema';
import { withTx } from '../db/tx';
import { AccessService } from './access.service';
import { endSession, startSession } from './session.util';

const MAX_PASSWORD_FAILS = 5;
const PASSWORD_LOCK_MS = 5 * 60_000;
const MAX_PIN_FAILS = 5;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly school: SchoolContextService,
    private readonly access: AccessService,
  ) {}

  private async findUser(schoolId: string, username: string) {
    const [user] = await this.db
      .select()
      .from(userAccount)
      .where(
        and(
          eq(userAccount.schoolId, schoolId),
          eq(userAccount.username, username),
          isNull(userAccount.deletedAt),
        ),
      );
    return user;
  }

  async login(input: LoginInput, req: Request): Promise<Me> {
    const ctx = await this.school.get();
    const actor = (userId: string | null): Actor => ({ ...ctx, userId });
    const user = await this.findUser(ctx.schoolId, input.username);

    const reject = async (
      code: string,
      message: string,
      status: HttpStatus,
    ): Promise<never> => {
      await withTx(this.db, (tx) =>
        this.audit.record(tx, actor(user?.id ?? null), {
          action: 'auth.login_failed',
          entity: 'user_account',
          entityId: user?.id,
          after: { username: input.username, reason: code },
        }),
      );
      throw new HttpException({ code, message }, status);
    };

    if (!user) {
      return reject(
        'INVALID_CREDENTIALS',
        'Wrong username or password',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return reject(
        'ACCOUNT_LOCKED',
        `Too many wrong passwords; try again after ${user.lockedUntil.toISOString()}`,
        HttpStatus.LOCKED,
      );
    }
    if (!user.isActive) {
      return reject(
        'ACCOUNT_DISABLED',
        'Account is disabled',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!(await verify(user.passwordHash, input.password))) {
      await withTx(this.db, async (tx) => {
        const [{ failedCount }] = await tx
          .update(userAccount)
          .set({ failedCount: sql`${userAccount.failedCount} + 1` })
          .where(eq(userAccount.id, user.id))
          .returning({ failedCount: userAccount.failedCount });
        const locked = failedCount >= MAX_PASSWORD_FAILS;
        if (locked) {
          await tx
            .update(userAccount)
            .set({
              failedCount: 0,
              lockedUntil: new Date(Date.now() + PASSWORD_LOCK_MS),
            })
            .where(eq(userAccount.id, user.id));
        }
        await this.audit.record(tx, actor(user.id), {
          action: 'auth.login_failed',
          entity: 'user_account',
          entityId: user.id,
          after: {
            username: input.username,
            reason: 'INVALID_CREDENTIALS',
            failedCount,
            locked,
          },
        });
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Wrong username or password',
      });
    }

    await withTx(this.db, async (tx) => {
      if (user.failedCount > 0 || user.lockedUntil) {
        await tx
          .update(userAccount)
          .set({ failedCount: 0, lockedUntil: null })
          .where(eq(userAccount.id, user.id));
      }
      await this.audit.record(tx, actor(user.id), {
        action: 'auth.login',
        entity: 'user_account',
        entityId: user.id,
      });
    });
    await startSession(req, user.id, ctx.schoolId);
    return this.me(user.id);
  }

  async switchUser(input: SwitchUserInput, req: Request): Promise<Me> {
    const current = req.actor!;
    const target = await this.findUser(current.schoolId, input.username);

    if (target) {
      // PIN failures since the later of 10 min ago and the target's last password login.
      const [{ fails }] = await this.db
        .select({ fails: count() })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.action, 'auth.pin_failed'),
            eq(auditLog.entityId, target.id),
            sql`${auditLog.createdAt} > greatest(
              now() - interval '10 minutes',
              coalesce((select max(a.created_at) from audit_log a
                        where a.action = 'auth.login' and a.entity_id = ${target.id}), '-infinity'))`,
          ),
        );
      if (fails >= MAX_PIN_FAILS) {
        throw new HttpException(
          {
            code: 'PIN_LOCKED',
            message: 'Too many wrong PINs; log in with password',
          },
          HttpStatus.LOCKED,
        );
      }
    }

    const ok =
      !!target?.pinHash &&
      target.isActive &&
      !(target.lockedUntil && target.lockedUntil > new Date()) &&
      (await verify(target.pinHash, input.pin));
    if (!target || !ok) {
      await withTx(this.db, (tx) =>
        this.audit.record(tx, current, {
          action: 'auth.pin_failed',
          entity: 'user_account',
          entityId: target?.id,
          after: { username: input.username },
        }),
      );
      throw new UnauthorizedException({
        code: 'INVALID_PIN',
        message: 'Wrong username or PIN',
      });
    }

    await withTx(this.db, (tx) =>
      this.audit.record(tx, current, {
        action: 'auth.switch',
        entity: 'user_account',
        entityId: target.id,
        before: { userId: current.userId },
        after: { userId: target.id },
      }),
    );
    await startSession(req, target.id, current.schoolId);
    return this.me(target.id);
  }

  async logout(req: Request): Promise<void> {
    const actor = req.actor!;
    await withTx(this.db, (tx) =>
      this.audit.record(tx, actor, {
        action: 'auth.logout',
        entity: 'user_account',
        entityId: actor.userId,
      }),
    );
    await endSession(req);
  }

  async me(userId: string): Promise<Me> {
    const access = await this.access.load(userId);
    if (!access) {
      throw new UnauthorizedException({
        code: 'SESSION_ENDED',
        message: 'Account is disabled or removed',
      });
    }
    const [p] = await this.db
      .select({ nameEn: person.nameEn, nameUr: person.nameUr })
      .from(userAccount)
      .innerJoin(person, eq(person.id, userAccount.personId))
      .where(eq(userAccount.id, userId));
    return {
      ...access.user,
      nameEn: p.nameEn,
      nameUr: p.nameUr,
      roles: access.roles,
      permissions: access.permissions,
    };
  }
}
