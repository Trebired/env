import { toTrimmedString } from "@trebired/utils";
import {
  readResolvedEnvPackageConfigSync,
  type EnvWriteConfig,
} from "#11n74g0387ae";
import {
  readEnvFile,
  writeEnvFileObject,
  writeEnvFileValue,
  type FrozenEnvMap,
  type WriteEnvFileOptions,
} from "#whj98feo4xxm";
import { configuredFilePolicy } from "./context.js";
import {
  normalizeConfiguredReadOptions,
  resolveConfiguredEnvFilePath,
} from "./paths.js";
import type {
  ConfiguredEnvFileKind,
  ConfiguredReadEnvFileOptions,
  ConfiguredWriteEnvFileOptions,
} from "./types.js";

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

function sortKeysFromWriteConfig(
  config: EnvWriteConfig | undefined,
): ((keys: string[]) => string[]) | undefined {
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

export {
  readConfiguredEnvFile,
  readConfiguredEnvFileString,
  writeConfiguredEnvFileObject,
  writeConfiguredEnvFileValue,
};
