import fs from "node:fs";
import path from "node:path";
import { toObject, toTrimmedString } from "@trebired/utils";
import {
  readResolvedEnvPackageConfigSync,
  type EnvFileConfig,
} from "#11n74g0387ae";
import {
  conditionMatches,
  configuredFilePolicy,
  createTokenContext,
  cwdOf,
  envFileKind,
  resolvePathTemplate,
  resolveRequestedExternalEnvFile,
} from "./context.js";
import type {
  ConfiguredEnvFileKind,
  ConfiguredReadEnvFileOptions,
  TokenContext,
} from "./types.js";

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

export {
  normalizeConfiguredReadOptions,
  resolveConfiguredEnvFilePath,
  resolveRepoEnvFilePath,
  isSelfReferentialExternalEnvFile,
};
