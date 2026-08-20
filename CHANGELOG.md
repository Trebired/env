# Changelog

All notable changes to `@trebired/env` will be documented here.

This project follows semantic versioning once published.

## 0.1.2

- Updated the logger-adapter dependency so env bootstrap initialization logs remain idempotent.

## 0.1.1

- Added configured env ownership APIs: `bootstrapProcessEnv`, `readConfiguredEnvFile`, `readConfiguredEnvFileString`, `writeConfiguredEnvFileValue`, `writeConfiguredEnvFileObject`, and `resolveConfiguredEnvFilePath`.
- Extended `.trebired/env/config.ts` so apps can declare internal/external file resolution, fallback policy, process-env bootstrap behavior, and write sorting without app-specific package code.
- Added logger-adapter initialization logging for env bootstrap.

## 0.1.0

- Added `readEnvFile`, `readEnvFileText`, `writeEnvFileValue`, `writeEnvFileObject`: env-file reading and writing, moved from `@trebired/utils`.
- Added `parseEnvText`, `formatEnvAssignment`, `serializeEnvLines`, `updateEnvTextValue`, `sortEnvKeys`, `stripEnvQuotes`, `parseEnvAssignmentLine`: line-level parsing and formatting primitives, moved from `@trebired/utils`.
- Added `readProcessEnv`, `readProcessEnvValue`, `writeProcessEnvValue`, `deleteProcessEnvValues`, `normalizeProcessEnvObject`, `buildProcessEnvObject`, `writeProcessEnvObject`: process-env helpers, moved from `@trebired/utils`.
- Added `readProcessEnvFlag`, `readProcessEnvNumber`, `readOptionalNonNegativeEnvNumber`: typed env-value parsing, moved from `@trebired/utils`.
- Added `.trebired/env/config.ts` support (`defineConfig`) with a configurable `envFileKinds` list, and `resolveConfiguredEnvFileKinds`/`assertValidEnvFileKind` to validate a `kind` against it.
