import { Injectable } from '@nestjs/common';

// SPEC §4: hlc = max(last + 1, Date.now() * 1000), monotonic per process.
@Injectable()
export class HlcService {
  private last = 0;

  now(): number {
    this.last = Math.max(this.last + 1, Date.now() * 1000);
    return this.last;
  }
}
