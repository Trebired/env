import { toObject, toTrimmedString } from "@trebired/utils";

type EnvMap = Record<string, string>;
type ProcessEnvObjectOptions = {
  allowedKeys?: readonly string[] | ReadonlySet<string>;
  onlyMissing?: boolean;
  removeKeys?: readonly string[];
  skipKeys?: readonly string[] | ReadonlySet<string>;
  useEnvFileValue?: boolean;
};

function readProcessEnv(): Readonly<EnvMap> {
  const out: EnvMap = {};
  for (const [key, value] of Object.entries(process.env || {})) {
    if (value != null) out[key] = String(value);
  }
  return Object.freeze(out);
}

function readProcessEnvValue(name: unknown): string {
  const key = toTrimmedString(name);
  const value = key ? process.env[key] : undefined;
  return value == null ? "" : String(value);
}

function writeProcessEnvValue(name: unknown, value: unknown): string {
  const key = toTrimmedString(name);
  if (!key) return "";
  process.env[key] = String(value ?? "");
  return readProcessEnvValue(key);
}

function deleteProcessEnvValues(keys: readonly unknown[]): void {
  for (const keyLike of keys) {
    const key = toTrimmedString(keyLike);
    if (key) delete process.env[key];
  }
}

function normalizeProcessEnvObject(entries: unknown): EnvMap {
  const out: EnvMap = {};
  for (const [keyLike, valueLike] of Object.entries(toObject(entries))) {
    const key = toTrimmedString(keyLike);
    if (key) out[key] = String(valueLike ?? "");
  }
  return out;
}

function buildProcessEnvObject(entries: unknown = {}, options: ProcessEnvObjectOptions = {}): EnvMap {
  const out = { ...readProcessEnv() };
  for (const key of options.removeKeys || []) delete out[toTrimmedString(key)];
  return Object.assign(out, normalizeProcessEnvObject(entries));
}

function writeProcessEnvObject(entries: unknown, options: ProcessEnvObjectOptions = {}): Readonly<EnvMap> {
  const src = normalizeProcessEnvObject(entries);
  const allowed = options.allowedKeys ? new Set(options.allowedKeys) : null;
  const skip = new Set(options.skipKeys || []);
  const out: EnvMap = {};
  for (const [key, value] of Object.entries(src)) {
    if (allowed && !allowed.has(key)) continue;
    if (skip.has(key) || key === "ENV_FILE_KIND" || key === "ENV_FILE_VALUE") continue;
    if (options.onlyMissing && process.env[key] != null) continue;
    process.env[key] = value;
    out[key] = value;
  }
  if (
    options.useEnvFileValue &&
      src.ENV_FILE_VALUE &&
      (!options.onlyMissing || process.env.ENV_FILE == null)
  ) {
    out.ENV_FILE = writeProcessEnvValue("ENV_FILE", src.ENV_FILE_VALUE);
  }
  return Object.freeze(out);
}

export {
  buildProcessEnvObject,
  deleteProcessEnvValues,
  normalizeProcessEnvObject,
  readProcessEnv,
  readProcessEnvValue,
  writeProcessEnvObject,
  writeProcessEnvValue,
};
export type { ProcessEnvObjectOptions };
