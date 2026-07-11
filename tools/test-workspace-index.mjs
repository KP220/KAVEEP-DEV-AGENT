import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildWorkspaceIndex, searchWorkspaceIndex } from "../src/repository/workspace-index.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "kaveep-index-test-"));
const repo = path.join(root, "repo"); const store = path.join(root, "index");
const clock = () => new Date("2026-07-11T00:00:00.000Z");
try {
  await mkdir(path.join(repo, "src"), { recursive: true }); await mkdir(path.join(repo, "node_modules"));
  await writeFile(path.join(repo, "src/auth-service.mjs"), "export function verifyAuthoritySnapshot(snapshot) { return snapshot.status === 'verified'; }\n");
  await writeFile(path.join(repo, "src/unrelated.mjs"), "export const color = 'blue';\n");
  await writeFile(path.join(repo, "src/provider-fixture.mjs"), "export const providerFixture = 'sk-example-fixture-123456789';\n");
  await writeFile(path.join(repo, ".env"), "OPENAI_API_KEY=never-index\n");
  await writeFile(path.join(repo, "node_modules/ignored.js"), "authority snapshot\n");
  await writeFile(path.join(repo, "binary.dat"), Buffer.from([0, 1, 2, 3]));
  try { await symlink(path.join(root, "outside"), path.join(repo, "outside-link"), "junction"); } catch {}
  const first = await buildWorkspaceIndex(repo, store, { clock });
  assert.equal(first.files.some((item) => item.path === "src/auth-service.mjs"), true);
  assert.equal(first.files.some((item) => item.path === ".env" || item.path.includes("node_modules") || item.path === "binary.dat"), false);
  assert(first.exclusions.some((item) => item.reason === "sensitive_path")); assert(first.exclusions.some((item) => item.reason === "binary_file"));
  const found = await searchWorkspaceIndex(store, "authority snapshot", { maxResults: 5, maxSnippetCharacters: 200, maxContextCharacters: 500 });
  assert.equal(found.status, "completed"); assert.equal(found.results[0].path, "src/auth-service.mjs"); assert(found.results[0].snippet.includes("verifyAuthoritySnapshot"));
  const redacted = await searchWorkspaceIndex(store, "providerFixture", { maxResults: 5, maxSnippetCharacters: 200, maxContextCharacters: 500 });
  assert.equal(redacted.results[0].snippet.includes("sk-example-fixture"), false); assert.equal(redacted.results[0].snippet.includes("[REDACTED]"), true); assert.equal(redacted.results[0].redactionCount, 1);
  const second = await buildWorkspaceIndex(repo, store, { clock });
  assert.equal(second.stats.reusedFiles, 3); assert.equal(second.stats.indexedFiles, 0);
  await writeFile(path.join(repo, "src/auth-service.mjs"), "export const changed = true;\n");
  const stale = await searchWorkspaceIndex(store, "authority snapshot");
  assert.equal(stale.results.length, 0); assert.deepEqual(stale.stalePaths, ["src/auth-service.mjs"]); assert.equal(stale.status, "stale");
  const updated = await buildWorkspaceIndex(repo, store, { clock });
  assert.equal(updated.stats.indexedFiles, 1); assert.equal(updated.stats.reusedFiles, 2);
  const bounded = await searchWorkspaceIndex(store, "changed", { maxResults: 1, maxSnippetCharacters: 10, maxContextCharacters: 10 });
  assert.equal(bounded.results.length, 1); assert(bounded.results[0].snippet.length <= 10);
  await assert.rejects(() => buildWorkspaceIndex(repo, path.join(repo, ".index")), /outside/);
  console.log("PASSED workspace index; incremental reuse; secret/binary/link exclusion; hash-reverified bounded search; stale omission");
} finally { await rm(root, { recursive: true, force: true }); }
