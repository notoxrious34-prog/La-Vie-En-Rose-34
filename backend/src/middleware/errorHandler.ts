import type { NextFunction, Request, Response } from 'express';
import { logReq } from '../lib/logger';

type HttpError = Error & { status?: number; code?: string };

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'not_found',
    path: req.originalUrl || req.url,
    requestId: (req as any).requestId,
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const e = err as HttpError;
  const status = typeof e?.status === 'number' && e.status >= 400 && e.status <= 599 ? e.status : 500;

  logReq(req, 'error', 'Unhandled error', {
    status,
    code: typeof e?.code === 'string' ? e.code : undefined,
    message: e instanceof Error ? e.message : String(err),
    stack: e instanceof Error ? e.stack : undefined,
  });

  if (res.headersSent) return;

  res.status(status).json({
    error: status === 500 ? 'internal_error' : 'request_error',
    message: status === 500 ? 'Internal server error' : e?.message,
    requestId: (req as any).requestId,
  });
}
