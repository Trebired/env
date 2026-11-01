# Changelog

All notable changes to `@trebired/env` will be documented here.

This project follows semantic versioning once published.

## 0.2.4

- Raised the dependency ranges to the current releases: `@trebired/logger-adapter` to `^0.8.2`, `@trebired/utils` to `^0.9.7`.
- Moved the repository's own Code Discipline config to `@trebired/code-discipline` 8 and the named preset `@trebired/configs/code-discipline/preset_01` from `@trebired/configs` 0.6.0.

## 0.2.3

- Moved to `@trebired/logger-adapter` 0.6.0, which depends on `@trebired/logger` 3.0.0.
- Updated the shipped `.trebired/logger/config.ts` `forVersion` to `3.0.0`. The logger checks `forVersion` by major and minor version, so under `@trebired/logger` 3.0 the old `2.7.0` value failed the check and this package's log prefix was dropped.

## 0.2.2

- Changed the verification scripts and examples to print through `@trebired/logger-adapter` instead of `console` and `process.stdout`.

## 0.2.1

- Updated the shipped `.trebired/logger/config.ts` `forVersion` to `2.7.0` and the `@trebired/code-discipline` / `@trebired/configs` ranges to `^7.2.0` / `^0.4.0`. The logger config named an older release, so under `@trebired/logger` 2.7 the version check threw and this package's log prefix was dropped.

## 0.2.0

- Updated the `@trebired/utils` dependency range to `^0.9.0`, keeping every `@trebired` package on one range so a project cannot resolve two copies.

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
