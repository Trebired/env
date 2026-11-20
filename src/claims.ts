import { toTrimmedString } from "@trebired/utils";

type EnvClaim = { owner: string; value: string };
type EnvClaimRegistry = Map<string, EnvClaim|string>;

type ClaimedEnvReader = {
  number: (key: string, fallback: number, options?: { integer?: boolean; min?: number }) => number;
  string: (key: string) => string;
};

type ClaimEnvKeysOptions = {
  fileValues?: Readonly<Record<string, string>>;
};

const CLAIM_REGISTRY_KEY = Symbol.for ("trebired.env.claims");

class EnvKeyClaimedError extends Error {
  readonly code = "env-key-claimed";
  readonly key: string;
  readonly owner: string;

  constructor(key: string, owner: string) {
    super(`${key} is owned by ${owner}. Read it through ${owner}, not directly.`);
    this.name = "EnvKeyClaimedError";
    this.key = key;
    this.owner = owner;
  }
}

function claimRegistry(): EnvClaimRegistry {
  const holder = globalThis as unknown as Record<symbol, EnvClaimRegistry|undefined>;
  if (!holder[CLAIM_REGISTRY_KEY]) holder[CLAIM_REGISTRY_KEY] = new Map();
  return holder[CLAIM_REGISTRY_KEY] as EnvClaimRegistry;
}

function readClaim(key: string): EnvClaim | undefined {
  const entry = claimRegistry().get(key);
  return typeof entry === "string" ? { owner: entry, value: "" } : entry;
}

function envKeyOwner(key: unknown): string {
  return readClaim(toTrimmedString(key))?.owner || "";
}

function assertEnvKeyUnclaimed(key: unknown): void {
  const name = toTrimmedString(key);
  const owner = name ? readClaim(name)?.owner : "";
  if (owner) throw new EnvKeyClaimedError(name, owner);
}

function withoutClaimedKeys<T extends Record<string, unknown>>(values: T): T {
  const registry = claimRegistry();
  if (!registry.size) return values;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!registry.has(key)) out[key] = value;
  }
  return out as T;
}

function readClaimedNumber(raw: string, fallback: number, options: { integer?: boolean; min?: number } = {}) {
  if (!raw.trim()) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = options.integer ? Math.floor(parsed) : parsed;
  return options.min == null ? normalized : Math.max(options.min, normalized);
}

function claimEnvKeys(ownerInput: unknown, keysInput: readonly unknown[], options: ClaimEnvKeysOptions = {}): ClaimedEnvReader {
  const owner = toTrimmedString(ownerInput);
  if (!owner) throw new Error("missing-env-claim-owner");
  const registry = claimRegistry();
  const keys = keysInput.map((key) => toTrimmedString(key)).filter(Boolean);
  for (const key of keys) {
    const current = readClaim(key)?.owner;
    if (current && current !== owner) throw new EnvKeyClaimedError(key, current);
  }
  const values: Record<string, string> = {};
  for (const key of keys) {
    const fileValue = toTrimmedString(options.fileValues && options.fileValues[key]);
    values[key] = fileValue || toTrimmedString(process.env[key]) || readClaim(key)?.value || "";
    registry.set(key, { owner, value: values[key] });
    delete process.env[key];
  }
  return {
    number: (key, fallback, numberOptions) => readClaimedNumber(values[key] || "", fallback, numberOptions),
    string: (key) => values[key] || "",
  };
}

export { assertEnvKeyUnclaimed, claimEnvKeys, EnvKeyClaimedError, envKeyOwner, withoutClaimedKeys };
export type { ClaimedEnvReader, ClaimEnvKeysOptions };
