import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      requestStartMs?: number;
    }
  }
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const id = typeof randomUUID === 'function' ? randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  req.requestId = id;
  req.requestStartMs = Date.now();

  res.setHeader('X-Request-Id', id);

  next();
}
