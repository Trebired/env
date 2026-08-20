import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = path.join(rootDir, ".tmp", "verify-pack");
const npmCacheDir = path.join(tempRoot, "npm-cache");
const packageJsonBackupPath = path.join(rootDir, ".tmp", "package.json.backup");
const nodeTypesDir = path.join(rootDir, "node_modules", "@types", "node");
const tscBin = path.join(rootDir, "node_modules", "typescript", "bin", "tsc");

async function main() {
  await resetTempRoot();

  const tarballPath = packPackage();
  const tarballEntries = listTarEntries(tarballPath);
  const packedPackageJson = readPackedPackageJson(tarballPath);

  validatePackedEntrypoints(packedPackageJson, tarballEntries);
  validatePackedImports(packedPackageJson, tarballEntries);
  await runConsumerSmokeTest(tarballPath);

  console.log("Pack verification succeeded.");
}

async function resetTempRoot() {
  await fs.rm(tempRoot, { force: true, recursive: true });
  await fs.mkdir(tempRoot, { recursive: true });
  await fs.mkdir(npmCacheDir, { recursive: true });
}

function packPackage() {
  const stdoutPath = path.join(tempRoot, "pack-output.json");

  try {
    execFileSync("sh", ["-lc", `npm pack --json > ${shellEscape(stdoutPath)}`], {
        ...createNpmOptions(rootDir),
        stdio: ["ignore", "inherit", "inherit"],
    });
  } catch (error) {
    restorePackageJsonFromBackup();
    throw error;
  }

  const stdout = execFileSync("cat", [stdoutPath], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  const [entry] = JSON.parse(stdout);
  if (!entry?.filename) throw new Error("npm pack did not return a tarball filename.");
  return path.join(rootDir, entry.filename);
}

function listTarEntries(tarballPath) {
  const stdout = execFileSync("tar", ["-tf", tarballPath], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  return new Set(stdout.split("\n").map((entry) => entry.trim()).filter(Boolean));
}

function readPackedPackageJson(tarballPath) {
  const stdout = execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  return JSON.parse(stdout);
}

function validatePackedEntrypoints(packageJson, tarballEntries) {
  const targets = collectEntrypointTargets(packageJson);
  for (const target of targets) {
    assertTarEntryExists(tarballEntries, target, `Missing packed entrypoint target: ${target}`);
  }
}

function collectEntrypointTargets(packageJson) {
  const targets = new Set();
  addTarget(targets, packageJson.main);
  addTarget(targets, packageJson.types);
  for (const value of Object.values(packageJson.exports || {})) collectExportTargets(value, targets);
  return targets;
}

function collectExportTargets(value, targets) {
  if (!value) return;
  if (typeof value === "string") {
    addTarget(targets, value);
    return;
  }
  for (const nested of Object.values(value)) collectExportTargets(nested, targets);
}

function addTarget(targets, value) {
  if (typeof value !== "string" || value.length === 0) return;
  targets.add(value);
}

function validatePackedImports(packageJson, tarballEntries) {
  for (const [alias, target] of Object.entries(packageJson.imports || {})) {
    if (typeof target !== "string") continue;
    if (target.includes("./src/") || target.includes("./internal/")) {
      throw new Error(`Packed imports entry ${alias} still points at source path ${target}.`);
    }
    assertTarEntryExists(tarballEntries, target, `Packed imports target is missing for ${alias}: ${target}`);
  }
}

function assertTarEntryExists(tarballEntries, packagePath, message) {
  const normalized = normalizePackagePath(packagePath);
  if (!tarballEntries.has(normalized)) throw new Error(message);
}

function normalizePackagePath(packagePath) {
  return `package/${String(packagePath).replace(/^\.\//u, "")}`;
}

async function runConsumerSmokeTest(tarballPath) {
  const consumerDir = path.join(tempRoot, "consumer");
  await fs.mkdir(consumerDir, { recursive: true });
  await writeConsumerManifest(consumerDir, tarballPath);
  await writeConsumerTypecheckFixture(consumerDir);
  await writeConsumerRuntimeFixture(consumerDir);
  await writeConsumerTsconfig(consumerDir);
  runConsumerChecks(consumerDir);
}

async function writeConsumerManifest(consumerDir, tarballPath) {
  await fs.writeFile(path.join(consumerDir, "package.json"), JSON.stringify({
        name: "env-pack-smoke",
        private: true,
        type: "module",
        dependencies: {
          "@package/env": `file:${tarballPath}`,
        },
        devDependencies: {
          "@types/node": `file:${nodeTypesDir}`,
        },
      }, null, 2));
}

async function writeConsumerTypecheckFixture(consumerDir) {
  await fs.writeFile(path.join(consumerDir, "index.ts"), [
      'import { defineConfig, formatEnvAssignment, readProcessEnvValue } from "@package/env";',
      "",
      "const config = defineConfig({ forVersion: \"0.1.0\", envFileKinds: [\"internal\", \"external\"] });",
      "const line: string = formatEnvAssignment(\"KEY\", \"value\", { quote: false });",
      "const value: string = readProcessEnvValue(\"PATH\");",
      "void config;",
      "void line;",
      "void value;",
    ].join("\n"));
}

async function writeConsumerRuntimeFixture(consumerDir) {
  await fs.writeFile(path.join(consumerDir, "runtime.mjs"), [
      'import fs from "node:fs";',
      'import os from "node:os";',
      'import path from "node:path";',
      'import { readEnvFile, writeEnvFileValue } from "@package/env";',
      "",
      "const envFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), \"env-pack-\")), \".env\");",
      "writeEnvFileValue(envFile, \"PORT\", 3100, { quote: false });",
      "const parsed = readEnvFile({ path: envFile, kind: \"external\" });",
      "console.log(parsed.PORT, parsed.ENV_FILE_KIND);",
    ].join("\n"));
}

async function writeConsumerTsconfig(consumerDir) {
  await fs.writeFile(path.join(consumerDir, "tsconfig.json"), JSON.stringify({
        compilerOptions: {
          lib: ["ES2020"],
          module: "ESNext",
          moduleResolution: "Bundler",
          noEmit: true,
          target: "ES2020",
          types: ["node"],
        },
        include: ["./index.ts"],
      }, null, 2));
}

function runConsumerChecks(consumerDir) {
  execFileSync("npm", ["install", "--ignore-scripts"], { ...createNpmOptions(consumerDir), stdio: "inherit" });
  execFileSync(process.execPath, [tscBin, "-p", "tsconfig.json"], { cwd: consumerDir, stdio: "inherit" });
  execFileSync("node", ["runtime.mjs"], { cwd: consumerDir, stdio: "inherit" });
}

function createNpmOptions(cwd) {
  return {
    cwd,
    env: { ...process.env, npm_config_cache: npmCacheDir },
  };
}

function restorePackageJsonFromBackup() {
  try {
    execFileSync("test", ["-f", packageJsonBackupPath], { cwd: rootDir, stdio: "ignore" });
  } catch {
    return;
  }
  execFileSync("cp", [packageJsonBackupPath, path.join(rootDir, "package.json")], { cwd: rootDir, stdio: "ignore" });
}

function shellEscape(value) {
  return `'${String(value).replace(/'/gu, `'\\''`)}'`;
  }

  await main();
