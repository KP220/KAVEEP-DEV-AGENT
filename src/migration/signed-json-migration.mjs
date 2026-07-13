import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, rename } from "node:fs/promises";
import path from "node:path";

const hash = (value) => createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
function canonical(value) { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function unsigned(plan) { const { signature, ...value } = plan ?? {}; return value; }
function validPath(value) { return typeof value === "string" && value.length > 0 && !path.isAbsolute(value) && !value.replace(/\\/g, "/").split("/").includes(".."); }
function validate(plan) {
  if (!plan || typeof plan !== "object" || !/^migration_[A-Za-z0-9_-]+$/.test(plan.migrationId ?? "") || plan.schemaVersion !== "1.0.0" || !/^[A-Za-z0-9._-]+$/.test(plan.artifactType ?? "") || !/^\d+\.\d+\.\d+$/.test(plan.fromVersion ?? "") || !/^\d+\.\d+\.\d+$/.test(plan.toVersion ?? "") || plan.fromVersion === plan.toVersion || plan.requiresHumanApproval !== true || plan.status !== "approved_for_migration" || !Array.isArray(plan.artifacts) || !plan.artifacts.length || !plan.issuedAt || !plan.expiresAt) throw new Error("Signed migration plan is invalid.");
  if (Number.isNaN(Date.parse(plan.issuedAt)) || Number.isNaN(Date.parse(plan.expiresAt)) || Date.parse(plan.expiresAt) <= Date.parse(plan.issuedAt)) throw new Error("Migration plan timestamps are invalid.");
  const paths = new Set();
  for (const item of plan.artifacts) { if (!validPath(item.path) || !/^[a-f0-9]{64}$/.test(item.beforeSha256 ?? "") || !/^[a-f0-9]{64}$/.test(item.afterSha256 ?? "") || item.beforeSha256 === item.afterSha256 || paths.has(item.path)) throw new Error("Migration artifact declaration is invalid."); paths.add(item.path); }
}
function signatureFor(plan, secret) { if (typeof secret !== "string" || secret.length < 16) throw new Error("Migration signing secret must be at least 16 characters."); return createHmac("sha256", secret).update(canonical(unsigned(plan))).digest("hex"); }
function target(root, relative) { const resolved = path.resolve(root, relative); const relation = path.relative(root, resolved); if (relation.startsWith("..") || path.isAbsolute(relation)) throw new Error("Migration path escaped the approved root."); return resolved; }

export function signMigrationPlan(plan, secret) { validate(plan); return { ...unsigned(plan), signature: signatureFor(plan, secret) }; }

export function verifyMigrationPlan(plan, secret, options = {}) {
  try {
    validate(plan);
    if (!/^[a-f0-9]{64}$/.test(plan.signature ?? "")) throw new Error("Migration signature is invalid.");
    const expected = Buffer.from(signatureFor(plan, secret), "hex"), observed = Buffer.from(plan.signature, "hex");
    if (expected.length !== observed.length || !timingSafeEqual(expected, observed)) throw new Error("Migration signature verification failed.");
    if (Date.parse(plan.expiresAt) <= (options.clock?.() ?? new Date()).getTime()) throw new Error("Migration approval has expired.");
    return { status: "verified", migrationId: plan.migrationId, artifactCount: plan.artifacts.length, verificationId: `migration_verification_${randomUUID()}`, recommendedNextAction: "apply_exact_migration" };
  } catch (error) { return { status: "blocked", error: error.message, recommendedNextAction: "request_human_approval" }; }
}

export async function applySignedJsonMigration(plan, secret, root, transform, options = {}) {
  const verification = verifyMigrationPlan(plan, secret, options);
  if (verification.status !== "verified") return { status: "blocked", verification, applied: [] };
  if (typeof transform !== "function") throw new Error("Migration transform must be a function.");
  const absoluteRoot = path.resolve(root); const prepared = [];
  for (const artifact of plan.artifacts) {
    const file = target(absoluteRoot, artifact.path); const beforeText = await readFile(file, "utf8");
    if (hash(beforeText) !== artifact.beforeSha256) return { status: "blocked", verification, applied: [], error: `Migration before-hash mismatch: ${artifact.path}` };
    const before = JSON.parse(beforeText); const after = await transform(structuredClone(before), structuredClone(artifact), structuredClone(plan)); const afterText = `${canonical(after)}\n`;
    if (hash(afterText) !== artifact.afterSha256) return { status: "blocked", verification, applied: [], error: `Migration after-hash mismatch: ${artifact.path}` };
    prepared.push({ artifact, file, afterText });
  }
  const temporary = [];
  try {
    for (const item of prepared) { const file = `${item.file}.${randomUUID()}.migration.tmp`; await mkdir(path.dirname(file), { recursive: true }); const handle = await open(file, "wx", 0o600); try { await handle.writeFile(item.afterText); await handle.sync(); } finally { await handle.close(); } temporary.push({ ...item, temporary: file }); }
    for (const item of temporary) await rename(item.temporary, item.file);
    return { status: "completed", verification, applied: prepared.map((item) => ({ path: item.artifact.path, beforeSha256: item.artifact.beforeSha256, afterSha256: item.artifact.afterSha256 })), recommendedNextAction: "verify_upgrade" };
  } catch (error) { return { status: "failed", verification, applied: [], error: error.message }; }
}
