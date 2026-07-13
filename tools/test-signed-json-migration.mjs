import assert from "node:assert/strict";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { applySignedJsonMigration, signMigrationPlan, verifyMigrationPlan } from "../src/migration/signed-json-migration.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "kaveep-migration-test-"));
const secret = "migration-test-secret-0001";
const clock = () => new Date("2026-07-13T00:00:00.000Z");
const canonical = (value) => `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${JSON.stringify(value[key])}`).join(",")}}`;
const digest = async (value) => (await import("node:crypto")).createHash("sha256").update(value).digest("hex");
try {
  const file = path.join(root, "record.json"), before = { formatVersion: "1.0.0", value: 1 }, after = { formatVersion: "1.1.0", value: 1, migrated: true };
  const beforeText = `${canonical(before)}\n`, afterText = `${canonical(after)}\n`;
  await writeFile(file, beforeText);
  const plan = signMigrationPlan({ migrationId: "migration_record_001", schemaVersion: "1.0.0", artifactType: "durable_record", fromVersion: "1.0.0", toVersion: "1.1.0", requiresHumanApproval: true, status: "approved_for_migration", issuedAt: clock().toISOString(), expiresAt: "2026-07-14T00:00:00.000Z", artifacts: [{ path: "record.json", beforeSha256: await digest(beforeText), afterSha256: await digest(afterText) }] }, secret);
  assert.equal(verifyMigrationPlan(plan, secret, { clock }).status, "verified");
  const applied = await applySignedJsonMigration(plan, secret, root, async (value) => ({ ...value, formatVersion: "1.1.0", migrated: true }), { clock });
  assert.equal(applied.status, "completed");
  assert.equal(await readFile(file, "utf8"), afterText);
  assert.equal((await applySignedJsonMigration(plan, secret, root, async (value) => value, { clock })).status, "blocked");
  assert.equal(verifyMigrationPlan({ ...plan, artifacts: [{ ...plan.artifacts[0], path: "../escape.json" }] }, secret, { clock }).status, "blocked");
  assert.equal(verifyMigrationPlan({ ...plan, signature: "0".repeat(64) }, secret, { clock }).status, "blocked");
  assert.equal(verifyMigrationPlan(plan, secret, { clock: () => new Date("2026-07-15T00:00:00.000Z") }).status, "blocked");
  const beforeOne = `${canonical({ formatVersion: "1.0.0", value: "one" })}\n`, beforeTwo = `${canonical({ formatVersion: "1.0.0", value: "two" })}\n`, afterOne = `${canonical({ formatVersion: "1.1.0", value: "one" })}\n`, afterTwo = `${canonical({ formatVersion: "1.1.0", value: "two" })}\n`;
  await writeFile(path.join(root, "one.json"), beforeOne); await writeFile(path.join(root, "two.json"), beforeTwo);
  const rollbackPlan = signMigrationPlan({ migrationId: "migration_rollback_001", schemaVersion: "1.0.0", artifactType: "durable_record", fromVersion: "1.0.0", toVersion: "1.1.0", requiresHumanApproval: true, status: "approved_for_migration", issuedAt: clock().toISOString(), expiresAt: "2026-07-14T00:00:00.000Z", artifacts: [{ path: "one.json", beforeSha256: await digest(beforeOne), afterSha256: await digest(afterOne) }, { path: "two.json", beforeSha256: await digest(beforeTwo), afterSha256: await digest(afterTwo) }] }, secret);
  let renameCalls = 0;
  const injectedFailure = await applySignedJsonMigration(rollbackPlan, secret, root, async (value) => ({ ...value, formatVersion: "1.1.0" }), { clock, rename: async (from, to) => { renameCalls += 1; if (renameCalls === 2) throw new Error("Injected commit failure."); return rename(from, to); } });
  assert.equal(injectedFailure.status, "failed"); assert.equal(injectedFailure.rollbackStatus, "completed");
  assert.equal(await readFile(path.join(root, "one.json"), "utf8"), beforeOne); assert.equal(await readFile(path.join(root, "two.json"), "utf8"), beforeTwo);
  console.log("PASSED signed JSON migration; human approval flag, HMAC, expiry, exact hashes, atomic apply, and path boundary");
} finally { await rm(root, { recursive: true, force: true }); }
