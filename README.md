# @trebired/env

Env file and process-env helpers for Trebired apps and packages: read and write `.env`-style files, resolve process environment values, and configure app-defined env-file kinds through `.trebired/env/config.ts`.

This package owns env-file parsing, formatting, and writing, and process-env read/write helpers. It does not own path resolution for *which* env file to read (internal vs. external, dev-data layout, legacy fallbacks) — the consuming app supplies the resolved path; it does not own secrets management, encryption, or remote config.

## Install

Runtime support: Bun 1+.

```sh
bun i @trebired/env
```

## Quick Start

```ts
import { readEnvFile, writeEnvFileValue } from "@trebired/env";

const env = readEnvFile({ path: ".env", kind: "external", required: false });
console.log(env.DATABASE_URL);

writeEnvFileValue(".env", "PORT", 3100, { quote: false });
```

## Concepts

### Env-file kind

`kind` is a free-form label (`"internal"`, `"external"`, or any app-defined string) attached to the parsed result as `ENV_FILE_KIND`. It carries no built-in meaning; apps that read from more than one env file use it to tell the results apart.

### Metadata keys

`readEnvFile` and the write functions return the parsed key/value map plus three reserved keys: `ENV_FILE` (the resolved absolute path), `ENV_FILE_KIND` (the `kind` passed in), and `ENV_FILE_VALUE` (the file's own `ENV_FILE=` line, if it declared one). These three keys are always stripped before writing entries back out.

## Configuration

### `.trebired/env/config.ts`

Optional. When present, `envFileKinds` restricts which `kind` values `assertValidEnvFileKind` accepts; without it, any string is accepted.

```ts
import { defineConfig } from "@trebired/env";

export default defineConfig({
  forVersion: "0.1.0",
  envFileKinds: ["internal", "external"],
});
```

`resolveConfiguredEnvFileKinds()` and `assertValidEnvFileKind(kind, configuredKinds)` are exported separately from `readEnvFile`/`writeEnvFileValue`/`writeEnvFileObject` — those stay synchronous and never load config themselves. Call `resolveConfiguredEnvFileKinds()` once (it's async) and pass the result to `assertValidEnvFileKind` wherever validation matters.

## Public API

- `readEnvFile(input?)`, `readEnvFileText(envFile, required?)`: read and parse an env file at a resolved path.
- `writeEnvFileValue(envFile, key, value, options?)`, `writeEnvFileObject(envFile, entries, options?)`: write one or many keys, `{ quote: false }` to skip JSON-quoting values, `{ sortKeys }` for a custom key order.
- `parseEnvText`, `formatEnvAssignment`, `serializeEnvLines`, `updateEnvTextValue`, `sortEnvKeys`, `stripEnvQuotes`, `parseEnvAssignmentLine`: the line-level parsing/formatting primitives the file functions are built from.
- `readProcessEnv`, `readProcessEnvValue`, `writeProcessEnvValue`, `deleteProcessEnvValues`, `normalizeProcessEnvObject`, `buildProcessEnvObject`, `writeProcessEnvObject`: `process.env` read/write helpers.
- `readProcessEnvFlag`, `readProcessEnvNumber`, `readOptionalNonNegativeEnvNumber`: typed env-value parsing.
- `defineConfig`, `resolveConfiguredEnvFileKinds`, `assertValidEnvFileKind`: `.trebired/env/config.ts` support.

## What It Does Not Do

This package does not:

- Resolve which env file to read for a given app (internal/external path resolution, dev-data layout, legacy fallbacks stay app-owned).
- Encrypt, sign, or remotely fetch env values.
- Watch env files for changes or hot-reload process env.
- Validate env values against a schema.
