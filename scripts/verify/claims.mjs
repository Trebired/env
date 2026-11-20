import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLogger } from "@package/logger-adapter";

const log = resolveLogger({ source: "@trebired/env" });
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const env = await import(path.join(rootDir, "dist", "index.js"));

function verifyClaimedKeys() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "env-claims-"));
  const file = path.join(dir, ".env");
  fs.writeFileSync(file, "VERIFY_DB_URL=postgres://file\nVERIFY_OTHER=kept\n");
  process.env.VERIFY_DB_URL = "postgres://process";
  process.env.VERIFY_DB_MAX = "7";

  const reader = env.claimEnvKeys("verify-owner", ["VERIFY_DB_URL", "VERIFY_DB_MAX"], {
      fileValues: env.readEnvFile(file),
  });
  assert.equal(reader.string("VERIFY_DB_URL"), "postgres://file", "the env file wins over the process value");
  assert.equal(reader.number("VERIFY_DB_MAX", 1, { integer: true }), 7, "a claimed number reads through the owner");
  assert.equal(process.env.VERIFY_DB_URL, undefined, "a claimed key leaves process.env");
  assert.equal(env.envKeyOwner("VERIFY_DB_URL"), "verify-owner");

  assert.throws(() => env.readProcessEnvValue("VERIFY_DB_URL"), (error) => error instanceof env.EnvKeyClaimedError && error.owner === "verify-owner");
  assert.throws(() => env.readProcessEnvNumber("VERIFY_DB_MAX", 1), env.EnvKeyClaimedError, "number readers refuse a claimed key");
  assert.throws(() => env.writeProcessEnvValue("VERIFY_DB_URL", "x"), env.EnvKeyClaimedError, "a claimed key cannot be written back");
  assert.throws(() => env.claimEnvKeys("someone-else", ["VERIFY_DB_URL"]), env.EnvKeyClaimedError, "a second owner is refused");

  const file2 = env.readEnvFile(file);
  assert.equal(file2.VERIFY_DB_URL, undefined, "reading the env file leaves claimed keys out");
  assert.equal(file2.VERIFY_OTHER, "kept", "unclaimed keys still read");
  assert.equal(env.readProcessEnv().VERIFY_DB_MAX, undefined, "the process env snapshot leaves claimed keys out");

  env.writeEnvFileObject(file, { VERIFY_OTHER: "changed" });
  const rewritten = env.parseEnvText(fs.readFileSync(file, "utf8"));
  assert.equal(rewritten.VERIFY_DB_URL, "postgres://file", "rewriting the env file keeps the claimed line");
  assert.equal(rewritten.VERIFY_OTHER, "changed", "rewriting the env file writes the given keys");
  assert.throws(() => env.writeEnvFileObject(file, { VERIFY_DB_URL: "x" }), env.EnvKeyClaimedError, "a claimed key cannot be rewritten");

  const again = env.claimEnvKeys("verify-owner", ["VERIFY_DB_MAX"]);
  assert.equal(again.string("VERIFY_DB_MAX"), "7", "a second claim by the owner still reads the value the first claim took out of process.env");
  fs.rmSync(dir, { force: true, recursive: true });
}

verifyClaimedKeys();
log.info("verify.claims", "Claim verification succeeded.");
