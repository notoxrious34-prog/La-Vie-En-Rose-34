import type { Request, Response } from 'express';

export function sendError(
  req: Request,
  res: Response,
  code: number,
  key: string,
  message?: string,
  extra?: Record<string, any>
) {
  const payload: Record<string, any> = {
    error: key,
    requestId: (req as any).requestId,
    ...(message && { message }),
    ...extra,
  };
  return res.status(code).json(payload);
}

export function sendSuccess(res: Response, payload: Record<string, any> = {}) {
  return res.json(payload);
}

export function sendCreated(res: Response, payload: Record<string, any> = {}) {
  return res.status(201).json(payload);
}

export function sendBadRequest(req: Request, res: Response, key = 'bad_request', message?: string) {
  return sendError(req, res, 400, key, message);
}

export function sendUnauthorized(req: Request, res: Response, message?: string) {
  return sendError(req, res, 401, 'unauthorized', message);
}

export function sendForbidden(req: Request, res: Response, message?: string) {
  return sendError(req, res, 403, 'forbidden', message);
}

export function sendNotFound(req: Request, res: Response, message?: string) {
  return sendError(req, res, 404, 'not_found', message);
}

export function sendConflict(req: Request, res: Response, key = 'conflict', message?: string) {
  return sendError(req, res, 409, key, message);
}

export function sendUnprocessable(req: Request, res: Response, key = 'unprocessable_entity', message?: string) {
  return sendError(req, res, 422, key, message);
}

export function sendInternalError(req: Request, res: Response, message?: string) {
  return sendError(req, res, 500, 'internal_error', message);
}
