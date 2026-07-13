import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES,
  RESULT_STATUSES,
  runControlledProcess
} from "../src/process/controlled-process-runner.mjs";

import {
  AUTHORIZATION_STATES,
  PROCESS_REQUEST_VALIDATOR_CAPABILITIES,
  validateProcessRequest
} from "../src/process/process-request-validator.mjs";

import {
  PROCESS_PROFILE_REGISTRY_CAPABILITIES,
  PROFILE_POLICY_VERSION,
  getProcessProfile,
  hasProcessProfile,
  listProcessProfileIds,
  listProcessProfiles
} from "../src/process/process-profile-registry.mjs";

// The runner must be tested against a repository owned by this test process.
// Using the checkout itself is not portable when a sandbox identity differs
// from the checkout owner, and must not be solved by weakening Git config.
const repositoryRoot = await mkdtemp(
  path.join(os.tmpdir(), "kaveep-controlled-process-")
);
execFileSync("git", ["init", "--quiet", repositoryRoot], {
  stdio: "ignore",
  windowsHide: true
});

let sequence = 0;

function nextIdentifier(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function createRequest(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    requestId: nextIdentifier("process-request"),
    profileId: "git.status-porcelain",
    arguments: [],
    workingDirectory: repositoryRoot,
    repositoryRoot,
    sandboxRoot: null,
    executionTarget: "source",
    authoritySnapshotId: "authority-snapshot-test",
    policyVersion: PROFILE_POLICY_VERSION,
    correlationId: nextIdentifier("correlation"),
    ...overrides
  };
}

function assertRejectedWithoutExecution(
  result,
  expectedClassification = null,
  expectedReason = null
) {
  assert.equal(result.executed, false);
  assert.equal(result.status, RESULT_STATUSES.REJECTED);
  assert.equal(result.shellAllowed, false);
  assert.equal(result.networkAllowed, false);
  assert.equal(result.sourceWriteAuthorityGranted, false);
  assert.equal(result.gitWriteAuthorityGranted, false);
  assert.equal(
    result.dependencyMutationAuthorityGranted,
    false
  );

  if (expectedClassification !== null) {
    assert.equal(
      result.classification,
      expectedClassification
    );
  }

  if (expectedReason !== null) {
    assert.equal(result.reason, expectedReason);
  }

  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.limitations));
  assert.ok(Object.isFrozen(result.evidence));
  assert.ok(Object.isFrozen(result.capabilities));
}

function assertApprovedDecision(decision, profileId) {
  assert.equal(
    decision.classification,
    AUTHORIZATION_STATES.APPROVED
  );

  assert.equal(decision.executed, false);
  assert.equal(decision.reason, "request_approved");
  assert.equal(
    decision.normalizedRequest.profileId,
    profileId
  );

  assert.match(
    decision.evidence.requestHash,
    /^[a-f0-9]{64}$/u
  );

  assert.equal(
    decision.evidence.shellAllowed,
    false
  );

  assert.equal(
    decision.evidence.networkAllowed,
    false
  );

  assert.equal(
    decision.evidence.sourceWriteAuthorityGranted,
    false
  );

  assert.equal(
    decision.evidence.gitWriteAuthorityGranted,
    false
  );

  assert.equal(
    decision.evidence
      .dependencyMutationAuthorityGranted,
    false
  );

  assert.ok(Object.isFrozen(decision));
  assert.ok(
    Object.isFrozen(decision.normalizedRequest)
  );
  assert.ok(
    Object.isFrozen(
      decision.normalizedRequest.arguments
    )
  );
  assert.ok(Object.isFrozen(decision.profile));
  assert.ok(Object.isFrozen(decision.evidence));
}

const expectedProfileIds = [
  "node.test",
  "node.lint",
  "node.typecheck",
  "node.build",
  "git.diff-check",
  "git.status-porcelain",
  "repository.quality-gates"
];

const profileIds = listProcessProfileIds();
const profiles = listProcessProfiles();

assert.deepEqual(profileIds, expectedProfileIds);
assert.equal(profiles.length, expectedProfileIds.length);

for (const profileId of expectedProfileIds) {
  assert.equal(hasProcessProfile(profileId), true);

  const profile = getProcessProfile(profileId);

  assert.notEqual(profile, null);
  assert.equal(profile.profileId, profileId);
  assert.equal(profile.policyVersion, PROFILE_POLICY_VERSION);
  assert.equal(profile.capabilities.shellAllowed, false);
  assert.equal(profile.capabilities.networkAllowed, false);

  assert.equal(
    profile.capabilities
      .sourceWriteAuthorityGranted,
    false
  );

  assert.equal(
    profile.capabilities
      .gitWriteAuthorityGranted,
    false
  );

  assert.equal(
    profile.capabilities
      .dependencyMutationAuthorityGranted,
    false
  );

  assert.ok(Object.isFrozen(profile));
  assert.ok(Object.isFrozen(profile.fixedArguments));
  assert.ok(
    Object.isFrozen(
      profile.allowedAdditionalArguments
    )
  );
  assert.ok(
    Object.isFrozen(profile.acceptedExitCodes)
  );
  assert.ok(
    Object.isFrozen(profile.supportedPlatforms)
  );
  assert.ok(
    Object.isFrozen(profile.environmentAllowlist)
  );
  assert.ok(
    Object.isFrozen(
      profile.blockedEnvironmentVariables
    )
  );
  assert.ok(Object.isFrozen(profile.capabilities));
}

assert.equal(getProcessProfile("unknown.profile"), null);
assert.equal(getProcessProfile(" node.test"), null);
assert.equal(getProcessProfile("node.test "), null);
assert.equal(getProcessProfile("NODE.TEST"), null);
assert.equal(hasProcessProfile("unknown.profile"), false);

const buildProfile = getProcessProfile("node.build");

assert.equal(buildProfile.executionTarget, "sandbox");
assert.equal(buildProfile.sourceExecutionAllowed, false);
assert.equal(buildProfile.sandboxExecutionAllowed, true);
assert.equal(
  buildProfile.riskClass,
  "WRITE_CAPABLE_SANDBOX_ONLY"
);

const gitStatusProfile = getProcessProfile(
  "git.status-porcelain"
);

assert.deepEqual(
  gitStatusProfile.fixedArguments,
  ["status", "--porcelain=v2"]
);

assert.equal(
  gitStatusProfile.requiresGitClassification,
  true
);

assert.equal(
  gitStatusProfile.requiredGitClassification,
  "READ_ONLY"
);

const approvedStatusRequest = createRequest();

const firstStatusDecision = validateProcessRequest(
  approvedStatusRequest
);

const secondStatusDecision = validateProcessRequest(
  approvedStatusRequest
);

assertApprovedDecision(
  firstStatusDecision,
  "git.status-porcelain"
);

assertApprovedDecision(
  secondStatusDecision,
  "git.status-porcelain"
);

assert.equal(
  firstStatusDecision.evidence.requestHash,
  secondStatusDecision.evidence.requestHash
);

const approvedDiffDecision = validateProcessRequest(
  createRequest({
    profileId: "git.diff-check"
  })
);

assertApprovedDecision(
  approvedDiffDecision,
  "git.diff-check"
);

const unknownProfileDecision =
  validateProcessRequest(
    createRequest({
      profileId: "unknown.profile"
    })
  );

assert.equal(
  unknownProfileDecision.classification,
  AUTHORIZATION_STATES.REJECTED
);

assert.equal(
  unknownProfileDecision.reason,
  "unknown_process_profile"
);

assert.equal(unknownProfileDecision.executed, false);

const shellFieldDecision =
  validateProcessRequest({
    ...createRequest(),
    shellCommand: "git status && echo unsafe"
  });

assert.equal(
  shellFieldDecision.classification,
  AUTHORIZATION_STATES.BLOCKED
);

assert.equal(
  shellFieldDecision.reason,
  "prohibited_request_field"
);

assert.equal(
  shellFieldDecision.evidence.field,
  "shellCommand"
);

const executableOverrideDecision =
  validateProcessRequest({
    ...createRequest(),
    executable: "sh"
  });

assert.equal(
  executableOverrideDecision.classification,
  AUTHORIZATION_STATES.BLOCKED
);

assert.equal(
  executableOverrideDecision.reason,
  "prohibited_request_field"
);

assert.equal(
  executableOverrideDecision.evidence.field,
  "executable"
);

const environmentOverrideDecision =
  validateProcessRequest({
    ...createRequest(),
    environment: {
      NODE_OPTIONS: "--require malicious.js"
    }
  });

assert.equal(
  environmentOverrideDecision.classification,
  AUTHORIZATION_STATES.BLOCKED
);

assert.equal(
  environmentOverrideDecision.reason,
  "prohibited_request_field"
);

assert.equal(
  environmentOverrideDecision.evidence.field,
  "environment"
);

const timeoutOverrideDecision =
  validateProcessRequest({
    ...createRequest(),
    timeoutMs: 1
  });

assert.equal(
  timeoutOverrideDecision.classification,
  AUTHORIZATION_STATES.BLOCKED
);

assert.equal(
  timeoutOverrideDecision.reason,
  "prohibited_request_field"
);

assert.equal(
  timeoutOverrideDecision.evidence.field,
  "timeoutMs"
);

const unknownFieldDecision =
  validateProcessRequest({
    ...createRequest(),
    unexpectedField: true
  });

assert.equal(
  unknownFieldDecision.classification,
  AUTHORIZATION_STATES.REJECTED
);

assert.equal(
  unknownFieldDecision.reason,
  "unknown_request_field"
);

assert.equal(
  unknownFieldDecision.evidence.field,
  "unexpectedField"
);

const shellArgumentDecision =
  validateProcessRequest(
    createRequest({
      arguments: ["&& echo unsafe"]
    })
  );

assert.equal(
  shellArgumentDecision.classification,
  AUTHORIZATION_STATES.BLOCKED
);

assert.equal(
  shellArgumentDecision.reason,
  "argument_contains_shell_metacharacter"
);

const arbitraryArgumentDecision =
  validateProcessRequest(
    createRequest({
      arguments: ["--short"]
    })
  );

assert.equal(
  arbitraryArgumentDecision.classification,
  AUTHORIZATION_STATES.BLOCKED
);

assert.equal(
  arbitraryArgumentDecision.reason,
  "additional_arguments_not_allowed"
);

const malformedArgumentDecision =
  validateProcessRequest(
    createRequest({
      arguments: [123]
    })
  );

assert.equal(
  malformedArgumentDecision.classification,
  AUTHORIZATION_STATES.REJECTED
);

assert.equal(
  malformedArgumentDecision.reason,
  "argument_must_be_string"
);

const relativePathDecision =
  validateProcessRequest(
    createRequest({
      workingDirectory: "."
    })
  );

assert.equal(
  relativePathDecision.classification,
  AUTHORIZATION_STATES.REJECTED
);

assert.equal(
  relativePathDecision.reason,
  "path_must_be_absolute"
);

const outsideDirectory = os.tmpdir();

if (
  path.resolve(outsideDirectory) !==
  path.resolve(repositoryRoot)
) {
  const pathEscapeDecision =
    validateProcessRequest(
      createRequest({
        workingDirectory: outsideDirectory
      })
    );

  assert.equal(
    pathEscapeDecision.classification,
    AUTHORIZATION_STATES.BLOCKED
  );

  assert.equal(
    pathEscapeDecision.reason,
    "working_directory_outside_repository"
  );
}

const buildAgainstSourceDecision =
  validateProcessRequest(
    createRequest({
      profileId: "node.build",
      executionTarget: "source"
    })
  );

assert.equal(
  buildAgainstSourceDecision.classification,
  AUTHORIZATION_STATES.BLOCKED
);

assert.equal(
  buildAgainstSourceDecision.reason,
  "profile_not_authorized_for_source_execution"
);

const buildWithoutSandboxDecision =
  validateProcessRequest(
    createRequest({
      profileId: "node.build",
      executionTarget: "sandbox",
      sandboxRoot: null
    })
  );

assert.equal(
  buildWithoutSandboxDecision.classification,
  AUTHORIZATION_STATES.REJECTED
);

assert.equal(
  buildWithoutSandboxDecision.reason,
  "sandbox_root_required_for_sandbox_execution"
);

const policyDriftDecision =
  validateProcessRequest(
    createRequest({
      policyVersion: "spec-037-v999"
    })
  );

assert.equal(
  policyDriftDecision.classification,
  AUTHORIZATION_STATES.REJECTED
);

assert.equal(
  policyDriftDecision.reason,
  "policy_version_mismatch"
);

const rejectedUnknownProfileResult =
  await runControlledProcess(
    createRequest({
      profileId: "unknown.profile"
    })
  );

assertRejectedWithoutExecution(
  rejectedUnknownProfileResult,
  AUTHORIZATION_STATES.REJECTED,
  "unknown_process_profile"
);

const rejectedShellResult =
  await runControlledProcess({
    ...createRequest(),
    command: "git status && echo unsafe"
  });

assertRejectedWithoutExecution(
  rejectedShellResult,
  AUTHORIZATION_STATES.BLOCKED,
  "prohibited_request_field"
);

const rejectedArgumentResult =
  await runControlledProcess(
    createRequest({
      arguments: ["--short"]
    })
  );

assertRejectedWithoutExecution(
  rejectedArgumentResult,
  AUTHORIZATION_STATES.BLOCKED,
  "additional_arguments_not_allowed"
);

const rejectedBuildSourceResult =
  await runControlledProcess(
    createRequest({
      profileId: "node.build",
      executionTarget: "source"
    })
  );

assertRejectedWithoutExecution(
  rejectedBuildSourceResult,
  AUTHORIZATION_STATES.BLOCKED,
  "profile_not_authorized_for_source_execution"
);

const gitStatusResult =
  await runControlledProcess(
    createRequest({
      profileId: "git.status-porcelain"
    })
  );

assert.equal(
  gitStatusResult.classification,
  AUTHORIZATION_STATES.APPROVED
);

assert.equal(gitStatusResult.executed, true);
assert.equal(
  gitStatusResult.status,
  RESULT_STATUSES.COMPLETED
);
assert.equal(gitStatusResult.exitCode, 0);
assert.equal(gitStatusResult.timedOut, false);
assert.equal(
  gitStatusResult.outputLimitExceeded,
  false
);
assert.equal(gitStatusResult.shellAllowed, false);
assert.equal(gitStatusResult.networkAllowed, false);

assert.equal(
  gitStatusResult.networkEnforcement,
  "UNVERIFIED"
);

assert.equal(
  gitStatusResult.sourceWriteAuthorityGranted,
  false
);

assert.equal(
  gitStatusResult.gitWriteAuthorityGranted,
  false
);

assert.equal(
  gitStatusResult
    .dependencyMutationAuthorityGranted,
  false
);

assert.equal(
  gitStatusResult.evidence.executableIdentity,
  "git"
);

assert.equal(
  gitStatusResult.evidence.gitClassification
    .classification,
  "READ_ONLY"
);

assert.equal(
  gitStatusResult.evidence.gitClassification
    .command,
  "status"
);

assert.deepEqual(
  gitStatusResult.evidence.gitClassification
    .normalizedArguments,
  ["--porcelain=v2"]
);

assert.match(
  gitStatusResult.evidence.requestHash,
  /^[a-f0-9]{64}$/u
);

assert.ok(
  gitStatusResult.limitations.some(
    (limitation) =>
      limitation.includes("Network denial")
  )
);

assert.ok(Object.isFrozen(gitStatusResult));
assert.ok(
  Object.isFrozen(gitStatusResult.limitations)
);
assert.ok(Object.isFrozen(gitStatusResult.evidence));
assert.ok(
  Object.isFrozen(gitStatusResult.capabilities)
);

assert.equal(
  PROCESS_PROFILE_REGISTRY_CAPABILITIES
    .shellStringsAccepted,
  false
);

assert.equal(
  PROCESS_PROFILE_REGISTRY_CAPABILITIES
    .arbitraryExecutablesAccepted,
  false
);

assert.equal(
  PROCESS_PROFILE_REGISTRY_CAPABILITIES
    .arbitraryArgumentsAccepted,
  false
);

assert.equal(
  PROCESS_PROFILE_REGISTRY_CAPABILITIES
    .networkAllowedByDefault,
  false
);

assert.equal(
  PROCESS_PROFILE_REGISTRY_CAPABILITIES
    .sourceWriteAuthorityGranted,
  false
);

assert.equal(
  PROCESS_PROFILE_REGISTRY_CAPABILITIES
    .gitWriteAuthorityGranted,
  false
);

assert.equal(
  PROCESS_PROFILE_REGISTRY_CAPABILITIES
    .dependencyMutationAuthorityGranted,
  false
);

assert.ok(
  Object.isFrozen(
    PROCESS_PROFILE_REGISTRY_CAPABILITIES
  )
);

assert.equal(
  PROCESS_REQUEST_VALIDATOR_CAPABILITIES
    .shellStringsAccepted,
  false
);

assert.equal(
  PROCESS_REQUEST_VALIDATOR_CAPABILITIES
    .arbitraryExecutableAccepted,
  false
);

assert.equal(
  PROCESS_REQUEST_VALIDATOR_CAPABILITIES
    .arbitraryArgumentsAccepted,
  false
);

assert.equal(
  PROCESS_REQUEST_VALIDATOR_CAPABILITIES
    .arbitraryEnvironmentAccepted,
  false
);

assert.equal(
  PROCESS_REQUEST_VALIDATOR_CAPABILITIES
    .pathCanonicalizationRequired,
  true
);

assert.equal(
  PROCESS_REQUEST_VALIDATOR_CAPABILITIES
    .pathContainmentRequired,
  true
);

assert.equal(
  PROCESS_REQUEST_VALIDATOR_CAPABILITIES
    .unknownProfilesFailClosed,
  true
);

assert.ok(
  Object.isFrozen(
    PROCESS_REQUEST_VALIDATOR_CAPABILITIES
  )
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .shellEnabled,
  false
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .arbitraryExecutablesAccepted,
  false
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .arbitraryArgumentsAccepted,
  false
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .arbitraryEnvironmentAccepted,
  false
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .networkAllowedByDefault,
  false
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .networkIsolationEnforced,
  false
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .sourceWriteAuthorityGranted,
  false
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .gitWriteAuthorityGranted,
  false
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .dependencyMutationAuthorityGranted,
  false
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .detachedProcessesAllowed,
  false
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .timeoutEnforced,
  true
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .outputLimitsEnforced,
  true
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .secretRedactionEnabled,
  true
);

assert.equal(
  CONTROLLED_PROCESS_RUNNER_CAPABILITIES
    .gitClassificationRequired,
  true
);

assert.ok(
  Object.isFrozen(
    CONTROLLED_PROCESS_RUNNER_CAPABILITIES
  )
);

await rm(repositoryRoot, { recursive: true, force: true });

console.log(
  [
    "Controlled process runner tests passed:",
    `${expectedProfileIds.length} profiles,`,
    "approved Git execution,",
    "deterministic request hashing,",
    "shell/executable/environment injection blocking,",
    "argument and path-boundary enforcement,",
    "sandbox-only build enforcement,",
    "no-execution rejection guarantees,",
    "immutable capability and result checks."
  ].join(" ")
);
