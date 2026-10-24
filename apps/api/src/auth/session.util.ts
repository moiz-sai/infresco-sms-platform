import type { Request } from 'express';

// New session id on every identity change (login, PIN switch) to prevent fixation.
export function startSession(req: Request, userId: string, schoolId: string) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err as Error);
      req.session.userId = userId;
      req.session.schoolId = schoolId;
      req.session.save((e) => (e ? reject(e as Error) : resolve()));
    });
  });
}

export function endSession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    if (!req.session) return resolve();
    req.session.destroy((err) => (err ? reject(err as Error) : resolve()));
  });
}
