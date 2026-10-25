import { Injectable } from '@nestjs/common';

const TTL_MS = 60_000;

// Per-school cache for GET /dashboard. Cleared after every successful write request
// (DashboardInvalidator), i.e. after the write's transaction has committed.
@Injectable()
export class DashboardCache<T = unknown> {
  private readonly entries = new Map<string, { at: number; value: T }>();
  private generation = 0;

  get(schoolId: string): T | undefined {
    const e = this.entries.get(schoolId);
    return e && Date.now() - e.at < TTL_MS ? e.value : undefined;
  }

  // Returns the generation to pass to set(), so a result computed across an invalidation is dropped.
  begin() {
    return this.generation;
  }

  set(schoolId: string, value: T, generation: number) {
    if (generation === this.generation) {
      this.entries.set(schoolId, { at: Date.now(), value });
    }
  }

  invalidate() {
    this.generation++;
    this.entries.clear();
  }
}
