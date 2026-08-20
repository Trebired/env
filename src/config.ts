import { loadPackageConfig } from "@trebired/utils";
import type { ProcessEnvObjectOptions } from "./process.js";

const PACKAGE_NAME = "env";

type EnvValueSource = "env" | "external" | "internal" | "process";
type EnvCondition = {
  all?: readonly EnvCondition[];
  any?: readonly EnvCondition[];
  equals?: string;
  exists?: boolean;
  ignoreCase?: boolean;
  key?: string;
  not?: EnvCondition;
  source?: EnvValueSource;
};
type EnvExternalDevModeConfig = {
  copyFirstExistingToDefault?: boolean;
  defaultPath?: string;
  fallbackPaths?: readonly string[];
  when?: EnvCondition;
};
type EnvFileConfig = {
  defaultPath?: string;
  devMode?: EnvExternalDevModeConfig;
  envKey?: string;
  fallbackPaths?: readonly string[];
  path?: string;
  required?: boolean;
};
type EnvProcessBootstrapConfig = ProcessEnvObjectOptions& {
  enabled?: boolean;
};
type EnvProcessConfig = {
  external?: EnvProcessBootstrapConfig;
  internal?: EnvProcessBootstrapConfig;
};
type EnvWriteConfig = {
  quote?: boolean;
  sortKeyRank?: readonly string[] | Record<string, number>;
};
type EnvPackageConfig = {
  envFileKinds?: readonly string[];
  files?: Record<string, EnvFileConfig>;
  forVersion: string;
  process?: EnvProcessConfig;
  write?: EnvWriteConfig;
};

type ResolveConfiguredKindsOptions = {
  cwd?: string;
};

function defineConfig(config: EnvPackageConfig): EnvPackageConfig {
  return config;
}

const DEFAULT_ENV_PACKAGE_CONFIG: EnvPackageConfig = Object.freeze({
    forVersion: "0.1.0",
});

let cachedEnvPackageConfig: EnvPackageConfig | null | undefined;

async function loadEnvPackageConfig(
  options: ResolveConfiguredKindsOptions = {},
): Promise<EnvPackageConfig|null> {
  const { config } = await loadPackageConfig<EnvPackageConfig>(PACKAGE_NAME, { cwd: options.cwd });
  return config;
}

async function resolveEnvPackageConfig(
  options: ResolveConfiguredKindsOptions = {},
): Promise<EnvPackageConfig> {
  if (cachedEnvPackageConfig !== undefined && !options.cwd) {
    return cachedEnvPackageConfig || DEFAULT_ENV_PACKAGE_CONFIG;
  }

  const config = await loadEnvPackageConfig(options);
  if (!options.cwd) cachedEnvPackageConfig = config || DEFAULT_ENV_PACKAGE_CONFIG;
  return config || DEFAULT_ENV_PACKAGE_CONFIG;
}

function readResolvedEnvPackageConfigSync(): EnvPackageConfig {
  return cachedEnvPackageConfig || DEFAULT_ENV_PACKAGE_CONFIG;
}

function setResolvedEnvPackageConfig(config: EnvPackageConfig | null | undefined): EnvPackageConfig {
  cachedEnvPackageConfig = config || DEFAULT_ENV_PACKAGE_CONFIG;
  return cachedEnvPackageConfig;
}

async function bootstrapEnvPackageConfig(
  options: ResolveConfiguredKindsOptions = {},
): Promise<EnvPackageConfig> {
  const config = await loadEnvPackageConfig(options);
  return setResolvedEnvPackageConfig(config);
}

async function resolveConfiguredEnvFileKinds(
  options: ResolveConfiguredKindsOptions = {},
): Promise<string[]|null> {
  const config = await resolveEnvPackageConfig(options);
  if (!config || !Array.isArray(config.envFileKinds)) return null;
  const kinds = config.envFileKinds.map((kind) => String(kind || "").trim()).filter(Boolean);
  return kinds.length ? kinds : null;
}

function assertValidEnvFileKind(kind: string, configuredKinds: readonly string[] | null): void {
  if (!configuredKinds) return;
  if (!configuredKinds.includes(kind)) {
    throw new Error(`invalid-env-file-kind :: ${kind} (configured: ${configuredKinds.join(", ")})`);
  }
}

export {
  assertValidEnvFileKind,
  bootstrapEnvPackageConfig,
  defineConfig,
  loadEnvPackageConfig,
  readResolvedEnvPackageConfigSync,
  resolveConfiguredEnvFileKinds,
  resolveEnvPackageConfig,
  setResolvedEnvPackageConfig,
};
export type {
  EnvCondition,
  EnvExternalDevModeConfig,
  EnvFileConfig,
  EnvPackageConfig,
  EnvProcessBootstrapConfig,
  EnvProcessConfig,
  EnvValueSource,
  EnvWriteConfig,
};
