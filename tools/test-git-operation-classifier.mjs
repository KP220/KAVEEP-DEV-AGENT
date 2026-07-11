import assert from "node:assert/strict";

import {
  GIT_CLASSIFICATION_CAPABILITIES,
  classifyGitOperation
} from "../src/git/git-operation-classifier.mjs";

function classify(command, arguments_ = []) {
  return classifyGitOperation({
    command,
    arguments: arguments_
  });
}

function expectClassification(command, arguments_, expected, reasonPattern = null) {
  const result = classify(command, arguments_);

  assert.equal(
    result.classification,
    expected,
    `${command} ${arguments_.join(" ")} should be ${expected}, got ${result.classification}: ${result.reason}`
  );

  assert.equal(result.command, command);
  assert.deepEqual(result.normalizedArguments, arguments_);
  assert.equal(result.networkAllowed, false);
  assert.equal(result.shellAllowed, false);
  assert.equal(result.writeAuthorityGranted, false);
  assert.equal(typeof result.reason, "string");
  assert.ok(result.reason.length > 0);
  assert.ok(Array.isArray(result.limitations));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.normalizedArguments));
  assert.ok(Object.isFrozen(result.limitations));

  if (reasonPattern) {
    assert.match(result.reason, reasonPattern);
  }

  return result;
}

const approvedCases = [
  ["status", []],
  ["status", ["--porcelain=v2"]],
  ["status", ["--short", "--branch"]],
  ["diff", []],
  ["diff", ["--check"]],
  ["diff", ["--cached", "--name-only"]],
  ["diff", ["HEAD"]],
  ["diff", ["HEAD~1..HEAD"]],
  ["diff", ["--no-ext-diff", "--no-color", "HEAD"]],
  ["log", ["--oneline", "-n", "10"]],
  ["log", ["--max-count=25", "--stat"]],
  ["log", ["--author", "KP220", "--grep=SPEC-036"]],
  ["show", ["--stat", "HEAD"]],
  ["show", ["--no-patch", "--format=%H", "HEAD"]],
  ["branch", ["--list"]],
  ["branch", ["--show-current"]],
  ["branch", ["--contains", "HEAD"]],
  ["rev-parse", ["--show-toplevel"]],
  ["rev-parse", ["--verify", "HEAD"]],
  ["rev-parse", ["HEAD"]],
  ["ls-files", []],
  ["ls-files", ["--cached", "--modified"]],
  ["diff-index", ["--quiet", "HEAD", "--"]],
  ["diff-index", ["--name-only", "HEAD", "--"]],
  ["cat-file", ["-t", "HEAD"]],
  ["cat-file", ["-s", "HEAD"]]
];

for (const [command, arguments_] of approvedCases) {
  expectClassification(command, arguments_, "READ_ONLY");
}

const writeCases = [
  ["add", ["."]],
  ["commit", ["-m", "test"]],
  ["push", []],
  ["pull", []],
  ["merge", ["main"]],
  ["rebase", ["main"]],
  ["reset", ["--hard"]],
  ["checkout", ["main"]],
  ["switch", ["main"]],
  ["restore", ["."]],
  ["cherry-pick", ["HEAD"]],
  ["revert", ["HEAD"]],
  ["tag", ["v1.0.0"]],
  ["stash", []],
  ["clean", ["-fd"]],
  ["rm", ["file.txt"]],
  ["mv", ["a.txt", "b.txt"]],
  ["init", []],
  ["clone", ["example"]],
  ["fetch", []],
  ["remote", ["add", "origin", "example"]],
  ["config", ["user.name", "test"]],
  ["submodule", ["update"]],
  ["worktree", ["add", "../other"]],
  ["notes", ["add"]],
  ["replace", ["HEAD", "HEAD~1"]],
  ["update-ref", ["refs/heads/main", "HEAD"]],
  ["symbolic-ref", ["HEAD", "refs/heads/main"]],
  ["gc", []],
  ["prune", []],
  ["repack", []],
  ["maintenance", ["run"]],
  ["bisect", ["start"]],
  ["am", ["patch.mbox"]],
  ["apply", ["change.patch"]]
];

for (const [command, arguments_] of writeCases) {
  expectClassification(command, arguments_, "WRITE_OPERATION", /write-capable|remote-capable/);
}

const blockedCases = [
  ["status", ["--unknown-option"]],
  ["status", ["--git-dir=/tmp/other"]],
  ["diff", ["--unknown-option"]],
  ["diff", ["--work-tree", "/tmp/other"]],
  ["diff", ["--", "../outside.txt"]],
  ["log", ["-n", "1001"]],
  ["log", ["--max-count=1001"]],
  ["log", ["--format=%n"]],
  ["show", ["HEAD", "HEAD~1"]],
  ["show", ["--pretty=%x00"]],
  ["branch", []],
  ["branch", ["feature/new"]],
  ["branch", ["-D", "feature/new"]],
  ["rev-parse", ["--show-cdup"]],
  ["rev-parse", ["--verify", "--end-of-options"]],
  ["ls-files", ["--stage"]],
  ["diff-index", ["HEAD", "--"]],
  ["cat-file", ["--batch"]],
  ["co", []],
  ["lg", []],
  ["unknown-command", []]
];

for (const [command, arguments_] of blockedCases) {
  expectClassification(command, arguments_, "BLOCKED");
}

const invalidRequestCases = [
  null,
  [],
  {},
  { command: "status" },
  { command: "STATUS", arguments: [] },
  { command: "status;rm", arguments: [] },
  { command: "status", arguments: "not-an-array" },
  { command: "status", arguments: [1] },
  { command: "status", arguments: [""] },
  { command: "status", arguments: ["line\nbreak"] },
  { command: "status", arguments: ["x".repeat(301)] },
  { command: "status", arguments: Array.from({ length: 65 }, () => "--short") }
];

for (const request of invalidRequestCases) {
  const result = classifyGitOperation(request);
  assert.equal(result.classification, "BLOCKED");
  assert.equal(result.networkAllowed, false);
  assert.equal(result.shellAllowed, false);
  assert.equal(result.writeAuthorityGranted, false);
  assert.match(result.reason, /must|accepted|exceeds|empty|control/i);
}

const aliasInjection = classifyGitOperation({
  command: "status",
  arguments: ["-calias.x=!echo unsafe"]
});
assert.equal(aliasInjection.classification, "BLOCKED");
assert.match(aliasInjection.reason, /Blocked global Git mechanism/);

const configInjection = classifyGitOperation({
  command: "status",
  arguments: ["--config-env=credential.helper=SECRET_ENV"]
});
assert.equal(configInjection.classification, "BLOCKED");

const gitDirInjection = classifyGitOperation({
  command: "status",
  arguments: ["--git-dir", "/tmp/other"]
});
assert.equal(gitDirInjection.classification, "BLOCKED");

const workTreeInjection = classifyGitOperation({
  command: "status",
  arguments: ["--work-tree=/tmp/other"]
});
assert.equal(workTreeInjection.classification, "BLOCKED");

assert.equal(GIT_CLASSIFICATION_CAPABILITIES.schemaVersion, "1.0.0");
assert.equal(GIT_CLASSIFICATION_CAPABILITIES.classifier, "deterministic");
assert.equal(GIT_CLASSIFICATION_CAPABILITIES.executableInvocationAccepted, false);
assert.equal(GIT_CLASSIFICATION_CAPABILITIES.shellStringsAccepted, false);
assert.equal(GIT_CLASSIFICATION_CAPABILITIES.userEnvironmentOverridesAccepted, false);
assert.equal(GIT_CLASSIFICATION_CAPABILITIES.aliasesAccepted, false);
assert.equal(GIT_CLASSIFICATION_CAPABILITIES.networkAllowed, false);
assert.equal(GIT_CLASSIFICATION_CAPABILITIES.writeAuthorityGranted, false);
assert.ok(
  GIT_CLASSIFICATION_CAPABILITIES.approvedReadOnlyCommands.includes("status")
);
assert.ok(
  GIT_CLASSIFICATION_CAPABILITIES.approvedReadOnlyCommands.includes("diff")
);
assert.ok(
  GIT_CLASSIFICATION_CAPABILITIES.writeCommandsBlockedFromExecution.includes("commit")
);
assert.ok(
  GIT_CLASSIFICATION_CAPABILITIES.writeCommandsBlockedFromExecution.includes("push")
);
assert.ok(Object.isFrozen(GIT_CLASSIFICATION_CAPABILITIES));

console.log(
  `Git operation classifier tests passed: ${approvedCases.length} approved, ${writeCases.length} write-classified, ${blockedCases.length} blocked, ${invalidRequestCases.length} invalid requests.`
);
