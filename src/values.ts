import { readProcessEnvValue } from "./process.js";

type ReadProcessEnvNumberOptions = {
  integer?: boolean;
  min?: number;
};

function readProcessEnvFlag(name: string, fallback: boolean): boolean {
  const value = readProcessEnvValue(name).trim().toLowerCase();
  if (!value) return fallback;
  if (value === "0" || value === "false" || value === "off" || value === "no") return false;
  if (value === "1" || value === "true" || value === "on" || value === "yes") return true;
  return fallback;
}

function readProcessEnvNumber(
  name: string,
  fallback: number,
  options: ReadProcessEnvNumberOptions = {},
): number {
  const raw = readProcessEnvValue(name);
  if (!raw.trim()) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = options.integer ? Math.floor(parsed) : parsed;
  return options.min == null ? normalized : Math.max(options.min, normalized);
}

function readOptionalNonNegativeEnvNumber(value: unknown): number | undefined {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export { readOptionalNonNegativeEnvNumber, readProcessEnvFlag, readProcessEnvNumber };
export type { ReadProcessEnvNumberOptions };
