import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { commitReviewedChange, createGitApprovalBundle } from "../src/git/controlled-git-workflow.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "kaveep-git-workflow-test-")); const ledger = path.join(root, "approval-ledger"); const repo = path.join(root, "repo");
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", windowsHide: true }).trim(); const hash = (value) => createHash("sha256").update(value).digest("hex");
const clock = () => new Date("2026-07-11T00:00:00.000Z"); const secret = "controlled-git-test-secret-123456";
try {
  await mkdir(path.join(repo, "src"), { recursive: true }); await writeFile(path.join(repo, "src/index.mjs"), "export const value = 1;\n"); await writeFile(path.join(repo, "notes.txt"), "initial\n");
  git("init", "-b", "main"); git("config", "user.name", "KAVEEP Test"); git("config", "user.email", "test@kaveep.invalid"); git("add", "."); git("commit", "-m", "initial");
  const before = "export const value = 1;\n", after = "export const value = 2;\n"; await writeFile(path.join(repo, "src/index.mjs"), after); await writeFile(path.join(repo, "notes.txt"), "unrelated user work\n");
  const patchHash = hash("reviewed patch evidence"); const reviewedChange = { reviewedChangeId: "reviewed_change_git_001", status: "ready_for_review", sourceSnapshotVerified: true, artifactAuthorizesSourceWrite: false, patchSha256: patchHash, changes: [{ path: "src/index.mjs", changeType: "modified", beforeSha256: hash(before), afterSha256: hash(after) }] };
  const writeResult = { status: "completed", sourcePostWriteVerified: true, patchSha256: patchHash, reviewedChangeRef: reviewedChange.reviewedChangeId, gitOperationPerformed: false };
  assert.throws(() => createGitApprovalBundle({ reviewedChange, reviewerId: "human_001", typedConfirmation: `APPROVE ${patchHash}`, trustedSecret: secret }, { clock }), /COMMIT/);
  const bundle = createGitApprovalBundle({ reviewedChange, reviewerId: "human_001", typedConfirmation: `COMMIT ${patchHash}`, trustedSecret: secret }, { clock });
  const result = await commitReviewedChange({ repositoryRoot: repo, reviewedChange, writeResult, bundle, trustedSecret: secret, approvalLedgerRoot: ledger, branchName: "kaveep/git-workflow-test", commitMessage: "Update reviewed value" }, { clock });
  assert.equal(result.status, "completed"); assert.deepEqual(result.stagedPaths, ["src/index.mjs"]); assert.match(result.commit, /^[a-f0-9]{40,64}$/); assert.equal(result.remoteOperationPerformed, false);
  assert.equal(git("branch", "--show-current"), "kaveep/git-workflow-test"); assert.equal(git("show", "--pretty=", "--name-only", "HEAD"), "src/index.mjs");
  assert.equal(await readFile(path.join(repo, "notes.txt"), "utf8"), "unrelated user work\n"); assert(git("status", "--short").includes("notes.txt"));
  const reused = await commitReviewedChange({ repositoryRoot: repo, reviewedChange, writeResult, bundle, trustedSecret: secret, approvalLedgerRoot: ledger, branchName: "kaveep/reuse", commitMessage: "Reuse" }, { clock }); assert.equal(reused.status, "blocked"); assert(reused.errors[0].includes("already consumed"));
  await writeFile(path.join(repo, "staged.txt"), "protected staged work\n"); git("add", "staged.txt");
  const bundle2 = createGitApprovalBundle({ reviewedChange, reviewerId: "human_001", typedConfirmation: `COMMIT ${patchHash}`, trustedSecret: secret }, { clock });
  const stagedBlocked = await commitReviewedChange({ repositoryRoot: repo, reviewedChange, writeResult, bundle: bundle2, trustedSecret: secret, approvalLedgerRoot: path.join(root, "ledger2"), branchName: "kaveep/staged-block", commitMessage: "Must block" }, { clock });
  assert.equal(stagedBlocked.status, "blocked"); assert(stagedBlocked.errors[0].includes("index is not empty")); assert.equal(git("diff", "--cached", "--name-only"), "staged.txt");
  console.log("PASSED controlled Git workflow; separate COMMIT approval; exact stage/commit; unrelated work preserved; staged work/reuse blocked; no remote operation");
} finally { await rm(root, { recursive: true, force: true }); }
