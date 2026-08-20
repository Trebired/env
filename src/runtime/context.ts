import path from "node:path";
import {
  readProductIdentity,
  toObject,
  toTrimmedString,
} from "@trebired/utils";
import type {
  EnvCondition,
  EnvFileConfig,
  EnvPackageConfig,
  EnvValueSource,
} from "#11n74g0387ae";
import { readProcessEnvValue } from "#sr2d14cg74bd";
import { DEFAULT_EXTERNAL_ENV_KEY } from "./constants.js";
import type { ConfiguredEnvFileKind, TokenContext } from "./types.js";

function cwdOf(input: unknown): string {
  return path.resolve(toTrimmedString(input) || process.cwd());
}

function envFileKind(input: unknown): ConfiguredEnvFileKind {
  return toTrimmedString(input, "external") as ConfiguredEnvFileKind;
}

function configuredFiles(config: EnvPackageConfig): Record<string, EnvFileConfig> {
  return config.files && typeof config.files === "object" ? config.files : {};
}

function configuredFilePolicy(
  config: EnvPackageConfig,
  kind: ConfiguredEnvFileKind,
): EnvFileConfig {
  const files = configuredFiles(config);
  const policy = files[kind];
  return policy && typeof policy === "object" ? policy : {};
}

function resolveProductTokens(cwd: string): Record<string, string> {
  const product = readProductIdentity({ startDir: cwd });
  return {
    displayName: product.displayName,
    domain: product.domain,
    envPrefix: product.envPrefix,
    name: product.name,
    packageName: product.packageName,
    repository: product.repository,
    slug: product.slug,
    version: product.version,
    website: product.website,
  };
}

function readSourceValue(
  source: EnvValueSource | undefined,
  key: unknown,
  context: TokenContext,
): string {
  const name = toTrimmedString(key);
  if (!name) return "";
  const normalizedSource = source === "external" || source === "process" || source === "env"
  ? source
  : "internal";
  if (normalizedSource === "external") {
    return toTrimmedString(context.externalEnvObject[name]);
  }
  if (normalizedSource === "env" || normalizedSource === "process") {
    return readProcessEnvValue(name);
  }
  return toTrimmedString(context.internalEnvObject[name]);
}

function conditionMatches(
  condition: EnvCondition | null | undefined,
  context: TokenContext,
): boolean {
  if (!condition || typeof condition !== "object") return false;
  if (Array.isArray(condition.any)) {
    return condition.any.some((entry) => conditionMatches(entry, context));
  }
  if (Array.isArray(condition.all)) {
    return condition.all.every((entry) => conditionMatches(entry, context));
  }
  if (condition.not) return !conditionMatches(condition.not, context);

  const key = toTrimmedString(condition.key);
  if (!key) return false;
  const value = readSourceValue(condition.source, key, context);
  if (condition.exists === true && !value) return false;
  if (condition.exists === false && value) return false;
  if (condition.equals != null) {
    const left = condition.ignoreCase ? value.toLowerCase() : value;
    const right = condition.ignoreCase
    ? toTrimmedString(condition.equals).toLowerCase()
    : toTrimmedString(condition.equals);
    return left === right;
  }
  return Boolean(value);
}

function tokenValue(name: string, context: TokenContext): string {
  if (name === "cwd") return context.cwd;
  if (name === "requested") return context.requestedEnvFile;
  if (name.startsWith("env.")) return readProcessEnvValue(name.slice(4));
  if (name.startsWith("process.")) return readProcessEnvValue(name.slice(8));
  if (name.startsWith("internal.")) {
    return toTrimmedString(context.internalEnvObject[name.slice(9)]);
  }
  if (name.startsWith("external.")) {
    return toTrimmedString(context.externalEnvObject[name.slice(9)]);
  }
  if (name.startsWith("product.")) {
    return toTrimmedString(context.product[name.slice(8)]);
  }
  return "";
}

function resolveTemplate(input: unknown, context: TokenContext): string {
  const template = toTrimmedString(input);
  if (!template) return "";
  return template.replace(/\{([A-Za-z0-9_.-]+)\}/g, (_match, name) =>
    tokenValue(String(name || ""), context),
  );
}

function resolvePathTemplate(input: unknown, context: TokenContext): string {
  const value = resolveTemplate(input, context);
  if (!value) return "";
  return path.isAbsolute(value)
  ? path.normalize(value)
  : path.resolve(context.cwd, value);
}

function createTokenContext(
  input: Partial<TokenContext>& { cwd?: string } = {},
): TokenContext {
  const cwd = cwdOf(input.cwd);
  return {
    cwd,
    externalEnvObject: toObject(input.externalEnvObject),
    internalEnvObject: toObject(input.internalEnvObject),
    product: input.product || resolveProductTokens(cwd),
    requestedEnvFile: toTrimmedString(input.requestedEnvFile),
  };
}

function resolveRequestedExternalEnvFile(
  policy: EnvFileConfig,
  context: TokenContext,
): string {
  const envKey = toTrimmedString(policy.envKey, DEFAULT_EXTERNAL_ENV_KEY);
  const raw =
  context.requestedEnvFile ||
    toTrimmedString(context.internalEnvObject.ENV_FILE_VALUE) ||
    readProcessEnvValue(envKey);
  return raw ? resolvePathTemplate(raw, context) : "";
}

export {
  conditionMatches,
  configuredFilePolicy,
  createTokenContext,
  cwdOf,
  envFileKind,
  resolvePathTemplate,
  resolveRequestedExternalEnvFile,
};
