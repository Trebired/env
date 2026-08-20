import fs from "node:fs";
import path from "node:path";
import { toObject, toTrimmedString } from "@trebired/utils";
import {
  formatEnvAssignment,
  parseEnvText,
  serializeEnvLines,
  sortEnvKeys,
  updateEnvTextValue,
} from "./lines.js";
import type { EnvMap, FormatEnvAssignmentOptions } from "./lines.js";

type EnvFileKind = string;
type ReadEnvFileOptions = {
  path?: string;
  envFile?: string;
  kind?: EnvFileKind;
  required?: boolean;
};
type WriteEnvFileOptions = FormatEnvAssignmentOptions& {
  sortKeys?: (keys: string[]) => string[];
};
type FrozenEnvMap = Readonly<EnvMap& {
  ENV_FILE: string;
  ENV_FILE_KIND: string;
  ENV_FILE_VALUE?: string;
}>;

function resolveEnvFileInput(input?: string | ReadEnvFileOptions): Required<ReadEnvFileOptions> {
  const src = typeof input === "string" ? { path: input } : toObject(input);
  return {
    envFile: toTrimmedString(src.envFile),
    kind: toTrimmedString(src.kind, "external"),
    path: toTrimmedString(src.path || src.envFile),
    required: src.required !== false,
  };
}

function withEnvMetadata(parsed: EnvMap, envFile: string, kind: string): FrozenEnvMap {
  const out: EnvMap = { ...parsed };
  if (typeof parsed.ENV_FILE === "string") out.ENV_FILE_VALUE = parsed.ENV_FILE;
  out.ENV_FILE = envFile;
  out.ENV_FILE_KIND = kind;
  return Object.freeze(out as FrozenEnvMap);
}

function readEnvFileText(envFile: unknown, required = true): string {
  const target = path.resolve(toTrimmedString(envFile));
  if (!target) throw new Error("missing-env-file");
  try {
    return fs.readFileSync(target, "utf8");
  } catch (error: unknown) {
    if (!required) return "";
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`env-file-read-failed: ${target}: ${message}`);
  }
}

function readEnvFile(input?: string | ReadEnvFileOptions): FrozenEnvMap {
  const options = resolveEnvFileInput(input);
  const target = path.resolve(options.path);
  const text = readEnvFileText(target, options.required);
  return withEnvMetadata(parseEnvText(text), target, options.kind);
}

function writeEnvFileValue(
  envFile: unknown,
  key: unknown,
  value: unknown,
  options: WriteEnvFileOptions = {},
): FrozenEnvMap {
  const target = path.resolve(toTrimmedString(envFile));
  const safeKey = toTrimmedString(key);
  if (!target) throw new Error("missing-env-file");
  if (!safeKey) throw new Error("missing-env-key");
  if (safeKey === "ENV_FILE") throw new Error("invalid-env-key");
  const nextText = updateEnvTextValue(readEnvFileText(target, false), safeKey, value, options);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, nextText, "utf8");
  return withEnvMetadata(parseEnvText(nextText), target, "external");
}

function writeEnvFileObject(
  envFile: unknown,
  entries: unknown,
  options: WriteEnvFileOptions = {},
): FrozenEnvMap {
  const target = path.resolve(toTrimmedString(envFile));
  if (!target) throw new Error("missing-env-file");
  const out: EnvMap = {};
  for (const [keyLike, valueLike] of Object.entries(toObject(entries))) {
    const key = toTrimmedString(keyLike);
    if (!key || key === "ENV_FILE" || key === "ENV_FILE_KIND" || key === "ENV_FILE_VALUE") continue;
    out[key] = String(valueLike ?? "");
  }
  const sort = options.sortKeys || sortEnvKeys;
  const nextText = serializeEnvLines(
    sort(Object.keys(out)).map((key) => formatEnvAssignment(key, out[key], options)),
  );
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, nextText, "utf8");
  return withEnvMetadata(parseEnvText(nextText), target, "external");
}

export {
  readEnvFile,
  readEnvFileText,
  writeEnvFileObject,
  writeEnvFileValue,
};
export type { EnvFileKind, FrozenEnvMap, ReadEnvFileOptions, WriteEnvFileOptions };
