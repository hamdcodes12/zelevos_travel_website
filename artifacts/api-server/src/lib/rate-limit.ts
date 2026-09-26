import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

export function createRateLimit(options: { windowMs: number; max: number; message: string }) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > options.max) {
      res.status(429).json({ status: "rate_limited", message: options.message });
      return;
    }

    next();
  };
}

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many authentication attempts. Please try again later.",
});

export const sensitiveRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many requests. Please try again shortly.",
});
