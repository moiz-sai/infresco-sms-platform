import 'express-session';

export interface Actor {
  schoolId: string;
  userId: string | null;
  deviceId: string | null;
}

declare module 'express-session' {
  interface SessionData {
    userId: string;
    schoolId: string;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor & { userId: string };
    }
  }
}
