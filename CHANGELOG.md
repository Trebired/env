# Changelog

All notable changes to `@trebired/env` will be documented here.

This project follows semantic versioning once published.

## 0.1.0

- Added `readEnvFile`, `readEnvFileText`, `writeEnvFileValue`, `writeEnvFileObject`: env-file reading and writing, moved from `@trebired/utils`.
- Added `parseEnvText`, `formatEnvAssignment`, `serializeEnvLines`, `updateEnvTextValue`, `sortEnvKeys`, `stripEnvQuotes`, `parseEnvAssignmentLine`: line-level parsing and formatting primitives, moved from `@trebired/utils`.
- Added `readProcessEnv`, `readProcessEnvValue`, `writeProcessEnvValue`, `deleteProcessEnvValues`, `normalizeProcessEnvObject`, `buildProcessEnvObject`, `writeProcessEnvObject`: process-env helpers, moved from `@trebired/utils`.
- Added `readProcessEnvFlag`, `readProcessEnvNumber`, `readOptionalNonNegativeEnvNumber`: typed env-value parsing, moved from `@trebired/utils`.
- Added `.trebired/env/config.ts` support (`defineConfig`) with a configurable `envFileKinds` list, and `resolveConfiguredEnvFileKinds`/`assertValidEnvFileKind` to validate a `kind` against it.
