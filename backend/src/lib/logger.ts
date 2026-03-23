import type { Request } from 'express';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function nowIso() {
  return new Date().toISOString();
}

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const line = {
    ts: nowIso(),
    level,
    message,
    ...(meta ? { meta } : {}),
  };

  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(safeJson(line));
    return;
  }
  if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(safeJson(line));
    return;
  }
  // eslint-disable-next-line no-console
  console.log(safeJson(line));
}

export function logReq(req: Request, level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const requestId = (req as any).requestId as string | undefined;
  log(level, message, {
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    ...(meta ?? {}),
  });
}
