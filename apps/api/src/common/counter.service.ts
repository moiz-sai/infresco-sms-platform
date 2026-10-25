import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { counter } from '../db/schema';
import type { Tx } from '../db/tx';

@Injectable()
export class CounterService {
  // Row lock on the counter serialises concurrent callers until their tx commits.
  async next(tx: Tx, schoolId: string, key: string): Promise<number> {
    const [row] = await tx
      .insert(counter)
      .values({ schoolId, key, value: 1 })
      .onConflictDoUpdate({
        target: [counter.schoolId, counter.key],
        set: { value: sql`${counter.value} + 1`, updatedAt: new Date() },
      })
      .returning({ value: counter.value });
    return row.value;
  }
}
