import fs from "node:fs";
import path from "node:path";

import {
  logPackageInitialized,
  resolveLogger,
  type LoggerAdapterLogger,
  type LoggerAdapterWriter,
} from "@package/logger-adapter";
import {
  readProductIdentity,
  toObject,
  toTrimmedString,
} from "@trebired/utils";
import {
  readResolvedEnvPackageConfigSync,
  setResolvedEnvPackageConfig,
  bootstrapEnvPackageConfig,
  type EnvCondition,
  type EnvFileConfig,
  type EnvPackageConfig,
  type EnvProcessBootstrapConfig,
  type EnvValueSource,
  type EnvWriteConfig,
} from "./config.js";
import {
  readEnvFile,
  writeEnvFileObject,
  writeEnvFileValue,
  type FrozenEnvMap,
  type WriteEnvFileOptions,
} from "./file.js";
import {
  readProcessEnv,
  readProcessEnvValue,
  writeProcessEnvObject,
  writeProcessEnvValue,
} from "./process.js";

type EnvLoggerInput = LoggerAdapterLogger | null | undefined;
type EnvLoggerAdapter = LoggerAdapterWriter | null | undefined;
type ConfiguredEnvFileKind = "external" | "internal" | (string & {});
type ConfiguredReadEnvFileOptions = {
  cwd?: string;
  externalEnvObject?: Record<string, unknown>;
  internalEnvObject?: Record<string, unknown>;
  kind?: ConfiguredEnvFileKind;
  requestedEnvFile?: string;
  required?: boolean;
};
type ConfiguredWriteEnvFileOptions = WriteEnvFileOptions& {
  cwd?: string;
  externalEnvObject?: Record<string, unknown>;
  internalEnvObject?: Record<string, unknown>;
  kind?: ConfiguredEnvFileKind;
  requestedEnvFile?: string;
};
type BootstrapProcessEnvOptions = {
  config?: EnvPackageConfig | null;
  cwd?: string;
  logger?: EnvLoggerInput;
  loggerAdapter?: EnvLoggerAdapter;
};
type BootstrapProcessEnvResult = Readonly<{
  developerModeEnv: Record<string, string>;
  externalEnvObject: FrozenEnvMap;
  injected: Record<string, string>;
  internalEnvObject: FrozenEnvMap;
  requestedExternalEnvFile: string;
  resolvedExternalEnvFile: string;
}>;

const ENV_PACKAGE_SOURCE = "@trebired/env";
const DEFAULT_EXTERNAL_ENV_KEY = "ENV_FILE";
let cachedProcessEnvBootstrap: BootstrapProcessEnvResult | null = null;
let cachedProcessEnvBootstrapCwd = "";

type TokenContext = {
  cwd: string;
  externalEnvObject: Record<string, unknown>;
  internalEnvObject: Record<string, unknown>;
  product: Record<string, string>;
  requestedEnvFile: string;
};

function cwdOf(input: unknown): string {
  return path.resolve(toTrimmedString(input) || process.cwd());
}

function envFileKind(input: unknown): ConfiguredEnvFileKind {
  return toTrimmedString(input, "external") as ConfiguredEnvFileKind;
}

function configuredFiles(config: EnvPackageConfig) {
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

function fileExists(filePath: string): boolean {
  return Boolean(filePath) && fs.existsSync(filePath);
}

function resolveCandidatePath(input: unknown, context: TokenContext): string {
  return resolvePathTemplate(input, context);
}

function resolveRepoEnvFilePath(cwdInput: unknown = process.cwd()): string {
  return path.resolve(cwdOf(cwdInput), ".env");
}

function isSelfReferentialExternalEnvFile(
  envFileInput: unknown,
  cwdInput: unknown = process.cwd(),
): boolean {
  const context = createTokenContext({
      cwd: cwdOf(cwdInput),
  });
  const envFile = resolveCandidatePath(envFileInput, context);
  return Boolean(envFile) && envFile === resolveRepoEnvFilePath(context.cwd);
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
  return raw ? resolveCandidatePath(raw, context) : "";
}

function ensureConfiguredDevEnvFile(
  target: string,
  repoEnvFile: string,
  candidates: readonly string[],
): string {
  if (!target) return "";
  if (fileExists(target)) return target;

  for (const candidate of candidates) {
    if (
      !candidate ||
        candidate === repoEnvFile ||
        candidate === target ||
        !fileExists(candidate)
    ) {
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(candidate, target);
    return target;
  }

  return target;
}

function resolveExternalConfiguredPath(
  policy: EnvFileConfig,
  context: TokenContext,
): string {
  const requested = resolveRequestedExternalEnvFile(policy, context);
  const nextContext = { ...context, requestedEnvFile: requested };
  const repoEnvFile = resolveRepoEnvFilePath(nextContext.cwd);
  const devMode = policy.devMode;

  if (devMode && conditionMatches(devMode.when, nextContext)) {
    const target = resolvePathTemplate(
      devMode.defaultPath || policy.defaultPath || policy.path,
      nextContext,
    );
    const candidates = (devMode.fallbackPaths || policy.fallbackPaths || [])
    .map((entry) => resolvePathTemplate(entry, nextContext))
    .filter(Boolean);
    if (devMode.copyFirstExistingToDefault === false) {
      return target || candidates.find(fileExists) || requested;
    }
    return ensureConfiguredDevEnvFile(target, repoEnvFile, candidates);
  }

  const explicit = policy.path
  ? resolvePathTemplate(policy.path, nextContext)
  : "";
  if (explicit) return explicit;

  if (requested && fileExists(requested)) return requested;

  const defaultPath = resolvePathTemplate(policy.defaultPath, nextContext);
  if (defaultPath && defaultPath !== repoEnvFile && fileExists(defaultPath)) {
    return defaultPath;
  }

  const fallback = (policy.fallbackPaths || [])
  .map((entry) => resolvePathTemplate(entry, nextContext))
  .find((entry) => entry && entry !== repoEnvFile && fileExists(entry));

  return fallback || requested || defaultPath;
}

function resolveConfiguredEnvFilePath(
  input?: ConfiguredEnvFileKind | ConfiguredReadEnvFileOptions,
): string {
  const options = normalizeConfiguredReadOptions(input);
  const config = readResolvedEnvPackageConfigSync();
  const policy = configuredFilePolicy(config, options.kind);
  const baseContext = createTokenContext({
      cwd: options.cwd,
      externalEnvObject: options.externalEnvObject,
      internalEnvObject: options.internalEnvObject,
      requestedEnvFile: options.requestedEnvFile,
  });

  if (options.kind === "internal") {
    return resolvePathTemplate(policy.path || policy.defaultPath || "{cwd}/.env", baseContext);
  }

  return resolveExternalConfiguredPath(policy, baseContext);
}

function normalizeConfiguredReadOptions(
  input?: ConfiguredEnvFileKind | ConfiguredReadEnvFileOptions,
): Required<ConfiguredReadEnvFileOptions> {
  const src = typeof input === "string" ? { kind: input } : toObject(input);
  return {
    cwd: cwdOf(src.cwd),
    externalEnvObject: toObject(src.externalEnvObject),
    internalEnvObject: toObject(src.internalEnvObject),
    kind: envFileKind(src.kind),
    requestedEnvFile: toTrimmedString(src.requestedEnvFile),
    required: src.required !== false,
  };
}

function readConfiguredEnvFile(
  input?: ConfiguredEnvFileKind | ConfiguredReadEnvFileOptions,
): FrozenEnvMap {
  const options = normalizeConfiguredReadOptions(input);
  const config = readResolvedEnvPackageConfigSync();
  const policy = configuredFilePolicy(config, options.kind);
  const target = resolveConfiguredEnvFilePath(options);
  if (!target) throw new Error("missing-env-file");
  return readEnvFile({
      path: target,
      kind: options.kind,
      required: options.required && policy.required !== false,
  });
}

function readConfiguredEnvFileString(
  key: unknown,
  input?: ConfiguredEnvFileKind | ConfiguredReadEnvFileOptions,
): string {
  const name = toTrimmedString(key);
  if (!name) return "";
  const source = readConfiguredEnvFile(input);
  return toTrimmedString(source[name]);
}

function sortKeysFromWriteConfig(config: EnvWriteConfig | undefined) {
  const rankInput = config && config.sortKeyRank;
  if (!rankInput) return undefined;
  const rank: Record<string, number> = {};
  if (Array.isArray(rankInput)) {
    rankInput.forEach((key, index) => {
        const name = toTrimmedString(key);
        if (name) rank[name] = index;
    });
  } else {
    for (const [key, value] of Object.entries(rankInput)) {
      const name = toTrimmedString(key);
      if (!name) continue;
      const number = Number(value);
      rank[name] = Number.isFinite(number) ? number : 0;
    }
  }
  return function sortConfiguredEnvKeys(keys: string[]): string[] {
    return keys.slice().sort((left, right) => {
        const leftKey = toTrimmedString(left);
        const rightKey = toTrimmedString(right);
        const leftRank = Object.prototype.hasOwnProperty.call(rank, leftKey)
        ? rank[leftKey]
        : 0;
        const rightRank = Object.prototype.hasOwnProperty.call(rank, rightKey)
        ? rank[rightKey]
        : 0;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return leftKey.localeCompare(rightKey);
    });
  };
}

function configuredWriteOptions(
  extra: WriteEnvFileOptions = {},
): WriteEnvFileOptions {
  const config = readResolvedEnvPackageConfigSync();
  return {
    quote: config.write?.quote === true,
    sortKeys: sortKeysFromWriteConfig(config.write),
    ...extra,
  };
}

function normalizeConfiguredWriteOptions(
  options: ConfiguredWriteEnvFileOptions = {},
): ConfiguredReadEnvFileOptions {
  return {
    cwd: options.cwd,
    externalEnvObject: options.externalEnvObject,
    internalEnvObject: options.internalEnvObject,
    kind: options.kind || "external",
    requestedEnvFile: options.requestedEnvFile,
    required: false,
  };
}

function writeConfiguredEnvFileValue(
  key: unknown,
  value: unknown,
  options: ConfiguredWriteEnvFileOptions = {},
): FrozenEnvMap {
  const envFile = resolveConfiguredEnvFilePath(
    normalizeConfiguredWriteOptions(options),
  );
  if (!envFile) throw new Error("missing-env-file");
  return writeEnvFileValue(envFile, key, value, configuredWriteOptions(options));
}

function writeConfiguredEnvFileObject(
  entries: unknown,
  options: ConfiguredWriteEnvFileOptions = {},
): FrozenEnvMap {
  const envFile = resolveConfiguredEnvFilePath(
    normalizeConfiguredWriteOptions(options),
  );
  if (!envFile) throw new Error("missing-env-file");
  return writeEnvFileObject(envFile, entries, configuredWriteOptions(options));
}

function normalizeProcessConfig(
  config: EnvProcessBootstrapConfig | undefined,
) {
  const source = config && typeof config === "object" ? config : {};
  const { enabled, ...processOptions } = source;
  return {
    enabled: enabled !== false,
    options: processOptions,
  };
}

function resolveEnvLogger(logger: EnvLoggerInput, adapter?: EnvLoggerAdapter) {
  return resolveLogger({
      adapter: adapter || undefined,
      defaultLogger: false,
      fallback: "noop",
      logger: logger || undefined,
      source: ENV_PACKAGE_SOURCE,
  });
}

function logInitialized(logger: EnvLoggerInput, adapter?: EnvLoggerAdapter) {
  logPackageInitialized({
      adapter: adapter || undefined,
      defaultLogger: false,
      fallback: "noop",
      logger: logger || undefined,
      source: ENV_PACKAGE_SOURCE,
  });
}

function logSelfReferentialExternalEnv(
  logger: ReturnType<typeof resolveEnvLogger>,
  requested: string,
  internalEnvObject: FrozenEnvMap,
  externalEnvObject: FrozenEnvMap,
) {
  if (
    !isSelfReferentialExternalEnvFile(requested) ||
      externalEnvObject.ENV_FILE === internalEnvObject.ENV_FILE
  ) {
    return;
  }

  logger.warn(
    "env",
    "external env file pointed to the internal env file; using configured runtime env file instead",
    {
      internal_env_file: internalEnvObject.ENV_FILE,
      requested_env_file: requested || null,
      resolved_env_file: externalEnvObject.ENV_FILE,
    },
  );
}

async function bootstrapProcessEnv(
  options: BootstrapProcessEnvOptions = {},
): Promise<BootstrapProcessEnvResult> {
  const cwd = cwdOf(options.cwd);
  if (
    options.config === undefined &&
      cachedProcessEnvBootstrap &&
      cachedProcessEnvBootstrapCwd === cwd
  ) {
    return cachedProcessEnvBootstrap;
  }

  const config = options.config !== undefined
  ? setResolvedEnvPackageConfig(options.config)
  : await bootstrapEnvPackageConfig({ cwd });
  const logger = resolveEnvLogger(options.logger, options.loggerAdapter);

  logInitialized(options.logger, options.loggerAdapter);

  const internalEnvObject = readConfiguredEnvFile({
      cwd,
      kind: "internal",
      required: false,
  });
  const internalProcess = normalizeProcessConfig(config.process?.internal);
  const injected = internalProcess.enabled
  ? writeProcessEnvObject(internalEnvObject, internalProcess.options)
  : Object.freeze({});

  const externalPolicy = configuredFilePolicy(config, "external");
  const requestedExternalEnvFile = resolveRequestedExternalEnvFile(
    externalPolicy,
    createTokenContext({ cwd, internalEnvObject }),
  );
  const externalEnvObject = readConfiguredEnvFile({
      cwd,
      internalEnvObject,
      kind: "external",
      requestedEnvFile: requestedExternalEnvFile,
      required: false,
  });
  const externalProcess = normalizeProcessConfig(config.process?.external);
  if (externalProcess.enabled) {
    writeProcessEnvObject(externalEnvObject, externalProcess.options);
  }

  const externalEnvKey = toTrimmedString(
    externalPolicy.envKey,
    DEFAULT_EXTERNAL_ENV_KEY,
  );
  if (externalEnvObject.ENV_FILE && externalEnvKey) {
    writeProcessEnvValue(externalEnvKey, externalEnvObject.ENV_FILE);
  }
  logSelfReferentialExternalEnv(
    logger,
    requestedExternalEnvFile,
    internalEnvObject,
    externalEnvObject,
  );

  const injectedCount = Object.keys(injected).filter(
    (key) => !/^ENV_FILE/.test(key),
  ).length;
  logger.info("env", "environment loaded", {
      source: internalEnvObject.ENV_FILE || null,
      external_source: externalEnvObject.ENV_FILE || null,
      injected: injectedCount,
  });

  const result = Object.freeze({
      developerModeEnv: {
        ...externalEnvObject,
        ...readProcessEnv(),
      },
      externalEnvObject,
      injected,
      internalEnvObject,
      requestedExternalEnvFile,
      resolvedExternalEnvFile: externalEnvObject.ENV_FILE,
  });
  cachedProcessEnvBootstrap = result;
  cachedProcessEnvBootstrapCwd = cwd;
  return result;
}

export {
  ENV_PACKAGE_SOURCE,
  bootstrapProcessEnv,
  isSelfReferentialExternalEnvFile,
  readConfiguredEnvFile,
  readConfiguredEnvFileString,
  resolveConfiguredEnvFilePath,
  resolveRepoEnvFilePath,
  writeConfiguredEnvFileObject,
  writeConfiguredEnvFileValue,
};
export type {
  BootstrapProcessEnvOptions,
  BootstrapProcessEnvResult,
  ConfiguredEnvFileKind,
  ConfiguredReadEnvFileOptions,
  ConfiguredWriteEnvFileOptions,
  EnvLoggerAdapter,
  EnvLoggerInput,
};
