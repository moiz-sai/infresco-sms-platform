import 'express-session';

export interface Actor {
  schoolId: string;
  userId: string | null;
  deviceId: string | null;
  // SPEC §Z1: holders of approvals.decide act directly instead of creating approval requests.
  canApprove?: boolean;
}

declare module 'express-session' {
  interface SessionData {
    userId: string;
    schoolId: string;
    // Developer profile unlock expiry (epoch ms); separate from a school login.
    devUntil: number;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}
