import assert from "node:assert/strict";
import { createSessionRequest } from "../src/app/standalone-app.mjs";

const snapshot = { repositoryRoot: "C:\\fixture", authoritySnapshotId: "authority_snapshot_budget", status: "verified" };
const lock = { authoritySnapshotRef: snapshot.authoritySnapshotId, status: "active" };
const defaults = { maxContextCharacters: 100000, maxOutputTokens: 8000, maxEdits: 20, maxAttempts: 3, semanticMaxAttempts: 2 };
const base = { repositoryRoot: snapshot.repositoryRoot, roots: { workspaceIndex: "C:\\index" }, execution: { profile: "node", image: "node:test", allowedImages: ["node:test"], requireContainer: false }, defaults };
const local = createSessionRequest({ ...base, provider: { id: "local-openai-compatible", model: "kaveep-local" } }, snapshot, lock, "modify code in src/index.mjs", { id: "local_budget" });
assert.equal(local.brain.budget.maxContextCharacters, 12000);
assert.equal(local.brain.budget.maxOutputTokens, 1024);
const remote = createSessionRequest({ ...base, provider: { id: "openai", model: "remote-model" } }, snapshot, lock, "modify code in src/index.mjs", { id: "remote_budget" });
assert.equal(remote.brain.budget.maxContextCharacters, 100000);
assert.equal(remote.brain.budget.maxOutputTokens, 8000);
console.log("PASSED local model runtime budget; conservative context/output caps; remote configuration unchanged");
