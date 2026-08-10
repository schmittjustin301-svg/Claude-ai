import type { Request } from "express";

/**
 * Express 5 types route params as `string | string[]`, because a wildcard
 * pattern can capture several path segments. Every route in this API uses a
 * plain `:name`, which always yields a single string — this centralises that
 * assumption instead of casting at each call site.
 */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}
