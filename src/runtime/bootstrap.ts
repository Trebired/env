import {
  logPackageInitialized,
  resolveLogger,
} from "@package/logger-adapter";
import {
  bootstrapEnvPackageConfig,
  setResolvedEnvPackageConfig,
  type EnvProcessBootstrapConfig,
} from "#11n74g0387ae";
import type { FrozenEnvMap } from "#whj98feo4xxm";
import {
  readProcessEnv,
  writeProcessEnvObject,
  writeProcessEnvValue,
} from "#sr2d14cg74bd";
import { toTrimmedString } from "@trebired/utils";
import {
  DEFAULT_EXTERNAL_ENV_KEY,
  ENV_PACKAGE_SOURCE,
} from "./constants.js";
import {
  configuredFilePolicy,
  createTokenContext,
  cwdOf,
  resolveRequestedExternalEnvFile,
} from "./context.js";
import { readConfiguredEnvFile } from "./files.js";
import { isSelfReferentialExternalEnvFile } from "./paths.js";
import type {
  BootstrapProcessEnvOptions,
  BootstrapProcessEnvResult,
  EnvLoggerAdapter,
  EnvLoggerInput,
} from "./types.js";

let cachedProcessEnvBootstrap: BootstrapProcessEnvResult | null = null;
let cachedProcessEnvBootstrapCwd = "";

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

export { bootstrapProcessEnv };
