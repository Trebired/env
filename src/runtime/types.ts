import type {
  LoggerAdapterLogger,
  LoggerAdapterWriter,
} from "@package/logger-adapter";
import type { EnvPackageConfig } from "#11n74g0387ae";
import type { FrozenEnvMap, WriteEnvFileOptions } from "#whj98feo4xxm";

type EnvLoggerInput = LoggerAdapterLogger | null | undefined;
type EnvLoggerAdapter = LoggerAdapterWriter | null | undefined;
type ConfiguredEnvFileKind = "external" | "internal" | (string& {});
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
type TokenContext = {
  cwd: string;
  externalEnvObject: Record<string, unknown>;
  internalEnvObject: Record<string, unknown>;
  product: Record<string, string>;
  requestedEnvFile: string;
};

export type {
  BootstrapProcessEnvOptions,
  BootstrapProcessEnvResult,
  ConfiguredEnvFileKind,
  ConfiguredReadEnvFileOptions,
  ConfiguredWriteEnvFileOptions,
  EnvLoggerAdapter,
  EnvLoggerInput,
  TokenContext,
};
