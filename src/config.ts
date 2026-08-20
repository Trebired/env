import { loadPackageConfig } from "@trebired/utils";

const PACKAGE_NAME = "env";

type EnvPackageConfig = {
  envFileKinds?: readonly string[];
  forVersion: string;
};

type ResolveConfiguredKindsOptions = {
  cwd?: string;
};

function defineConfig(config: EnvPackageConfig): EnvPackageConfig {
  return config;
}

async function resolveConfiguredEnvFileKinds(
  options: ResolveConfiguredKindsOptions = {},
): Promise<string[]|null> {
  const { config } = await loadPackageConfig<EnvPackageConfig>(PACKAGE_NAME, { cwd: options.cwd });
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

export { assertValidEnvFileKind, defineConfig, resolveConfiguredEnvFileKinds };
export type { EnvPackageConfig };
