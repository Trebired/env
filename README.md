# @trebired/env

Env file and process-env helpers for Trebired apps and packages: read and write `.env`-style files, resolve configured internal/external env files, bootstrap `process.env`, and configure app-defined env policy through `.trebired/env/config.ts`.

This package owns env-file parsing, formatting, configured env-file resolution, env-file writes, and process-env read/write/bootstrap helpers. App-specific paths, fallback policy, allowed process overrides, and write ordering are supplied declaratively by `.trebired/env/config.ts`; the package code stays generic.

## Install

Runtime support: Bun 1+.

```sh
bun i @trebired/env
```

## Quick Start

```ts
import {
  bootstrapProcessEnv,
  readConfiguredEnvFile,
  writeConfiguredEnvFileValue,
} from "@trebired/env";

await bootstrapProcessEnv();

const env = readConfiguredEnvFile({ kind: "external", required: false });
console.log(env.DATABASE_URL);

writeConfiguredEnvFileValue("PORT", 3100);
```

## Concepts

### Env-file kind

`kind` is a free-form label (`"internal"`, `"external"`, or any app-defined string) attached to the parsed result as `ENV_FILE_KIND`. It carries no built-in meaning; apps that read from more than one env file use it to tell the results apart.

### Metadata keys

`readEnvFile` and the write functions return the parsed key/value map plus three reserved keys: `ENV_FILE` (the resolved absolute path), `ENV_FILE_KIND` (the `kind` passed in), and `ENV_FILE_VALUE` (the file's own `ENV_FILE=` line, if it declared one). These three keys are always stripped before writing entries back out.

## Configuration

### `.trebired/env/config.ts`

Optional. When present, `envFileKinds` restricts which `kind` values `assertValidEnvFileKind` accepts; `files`, `process`, and `write` define configured env-file resolution, process injection, and write formatting.

```ts
import { defineConfig } from "@trebired/env";

export default defineConfig({
  forVersion: "0.1.1",
  envFileKinds: ["internal", "external"],
  files: {
    internal: { path: "{cwd}/.env" },
    external: {
      envKey: "ENV_FILE",
      defaultPath: "/etc/{product.slug}/app/.env",
      fallbackPaths: ["{requested}", "/data/{product.slug}/app/.env"],
    },
  },
  process: {
    internal: {
      onlyMissing: true,
      skipKeys: ["ENV_FILE"],
      useEnvFileValue: true,
    },
  },
});
```

Call `await bootstrapProcessEnv()` once during startup to load config, resolve the configured env files, apply configured process-env injection, and cache config for synchronous configured reads/writes.

## Public API

- `readEnvFile(input?)`, `readEnvFileText(envFile, required?)`: read and parse an env file at a resolved path.
- `writeEnvFileValue(envFile, key, value, options?)`, `writeEnvFileObject(envFile, entries, options?)`: write one or many keys, `{ quote: false }` to skip JSON-quoting values, `{ sortKeys }` for a custom key order.
- `bootstrapProcessEnv(options?)`: load `.trebired/env/config.ts`, resolve configured internal/external env files, apply configured process-env writes, and return the resolved env objects.
- `readConfiguredEnvFile(input?)`, `readConfiguredEnvFileString(key, input?)`, `writeConfiguredEnvFileValue(key, value, options?)`, `writeConfiguredEnvFileObject(entries, options?)`, `resolveConfiguredEnvFilePath(input?)`: config-backed env-file helpers.
- `parseEnvText`, `formatEnvAssignment`, `serializeEnvLines`, `updateEnvTextValue`, `sortEnvKeys`, `stripEnvQuotes`, `parseEnvAssignmentLine`: the line-level parsing/formatting primitives the file functions are built from.
- `readProcessEnv`, `readProcessEnvValue`, `writeProcessEnvValue`, `deleteProcessEnvValues`, `normalizeProcessEnvObject`, `buildProcessEnvObject`, `writeProcessEnvObject`: `process.env` read/write helpers.
- `readProcessEnvFlag`, `readProcessEnvNumber`, `readOptionalNonNegativeEnvNumber`: typed env-value parsing.
- `defineConfig`, `resolveConfiguredEnvFileKinds`, `assertValidEnvFileKind`: `.trebired/env/config.ts` support.

## What It Does Not Do

This package does not:

- Encrypt, sign, or remotely fetch env values.
- Watch env files for changes or hot-reload process env.
- Validate env values against a schema.
