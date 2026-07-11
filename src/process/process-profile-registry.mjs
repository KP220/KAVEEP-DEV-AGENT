const PROFILE_SCHEMA_VERSION = "1.0.0";
const PROFILE_POLICY_VERSION = "spec-037-v0.1";

const MAX_ARGUMENTS = 32;
const MAX_ARGUMENT_BYTES = 512;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;
const DEFAULT_STDOUT_LIMIT_BYTES = 1_048_576;
const DEFAULT_STDERR_LIMIT_BYTES = 1_048_576;

const SUPPORTED_PLATFORMS = Object.freeze([
  "win32",
  "linux",
  "darwin"
]);

const EXECUTION_TARGETS = Object.freeze({
  SOURCE: "source",
  SANDBOX: "sandbox",
  SOURCE_OR_SANDBOX: "source-or-sandbox"
});

const WORKING_DIRECTORY_POLICIES = Object.freeze({
  REPOSITORY_ROOT: "repository-root",
  SANDBOX_ROOT: "sandbox-root",
  APPROVED_BOUNDARY: "approved-boundary"
});

const PROFILE_RISK_CLASSES = Object.freeze({
  READ_ONLY: "READ_ONLY",
  VALIDATION: "VALIDATION",
  WRITE_CAPABLE_SANDBOX_ONLY: "WRITE_CAPABLE_SANDBOX_ONLY"
});

const EXECUTABLE_IDENTITIES = Object.freeze({
  NODE_PACKAGE_MANAGER: "npm",
  GIT: "git"
});

const EMPTY_ARGUMENTS = Object.freeze([]);
const ACCEPTED_ZERO_EXIT_CODE = Object.freeze([0]);

function freezeArray(values) {
  return Object.freeze([...values]);
}

function freezeProfile(profile) {
  return Object.freeze({
    ...profile,
    fixedArguments: freezeArray(profile.fixedArguments),
    allowedAdditionalArguments: freezeArray(
      profile.allowedAdditionalArguments
    ),
    acceptedExitCodes: freezeArray(profile.acceptedExitCodes),
    supportedPlatforms: freezeArray(profile.supportedPlatforms),
    environmentAllowlist: freezeArray(profile.environmentAllowlist),
    blockedEnvironmentVariables: freezeArray(
      profile.blockedEnvironmentVariables
    ),
    capabilities: Object.freeze({
      ...profile.capabilities
    })
  });
}

const MINIMAL_ENVIRONMENT_ALLOWLIST = Object.freeze([
  "PATH",
  "HOME",
  "USERPROFILE",
  "TEMP",
  "TMP",
  "TMPDIR",
  "SystemRoot",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "LANG",
  "LC_ALL",
  "TERM",
  "CI"
]);

const BLOCKED_ENVIRONMENT_VARIABLES = Object.freeze([
  "NODE_OPTIONS",
  "NODE_PATH",
  "NPM_CONFIG_USERCONFIG",
  "NPM_CONFIG_PREFIX",
  "GIT_CONFIG",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_SYSTEM",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_SSH",
  "GIT_SSH_COMMAND",
  "GIT_ASKPASS",
  "SSH_ASKPASS",
  "LD_PRELOAD",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
  "PYTHONPATH",
  "RUBYOPT",
  "PERL5OPT"
]);

const BASE_CAPABILITIES = Object.freeze({
  shellAllowed: false,
  networkAllowed: false,
  sourceWriteAuthorityGranted: false,
  gitWriteAuthorityGranted: false,
  dependencyMutationAuthorityGranted: false,
  detachedProcessAllowed: false,
  arbitraryExecutableAllowed: false,
  arbitraryArgumentsAllowed: false,
  arbitraryEnvironmentAllowed: false
});

function createProfile({
  profileId,
  description,
  executableIdentity,
  fixedArguments,
  allowedAdditionalArguments = EMPTY_ARGUMENTS,
  executionTarget,
  workingDirectoryPolicy,
  riskClass,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxStdoutBytes = DEFAULT_STDOUT_LIMIT_BYTES,
  maxStderrBytes = DEFAULT_STDERR_LIMIT_BYTES,
  acceptedExitCodes = ACCEPTED_ZERO_EXIT_CODE,
  requiresGitClassification = false,
  requiredGitClassification = null,
  sourceExecutionAllowed = false,
  sandboxExecutionAllowed = true,
  hardOutputLimit = true
}) {
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new Error(
      `Invalid timeout for process profile ${profileId}.`
    );
  }

  if (
    !Number.isInteger(maxStdoutBytes) ||
    maxStdoutBytes <= 0 ||
    !Number.isInteger(maxStderrBytes) ||
    maxStderrBytes <= 0
  ) {
    throw new Error(
      `Invalid output limit for process profile ${profileId}.`
    );
  }

  return freezeProfile({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    policyVersion: PROFILE_POLICY_VERSION,
    profileId,
    description,
    executableIdentity,
    fixedArguments,
    allowedAdditionalArguments,
    executionTarget,
    workingDirectoryPolicy,
    riskClass,
    timeoutMs,
    maxStdoutBytes,
    maxStderrBytes,
    maxArguments: MAX_ARGUMENTS,
    maxArgumentBytes: MAX_ARGUMENT_BYTES,
    acceptedExitCodes,
    requiresGitClassification,
    requiredGitClassification,
    sourceExecutionAllowed,
    sandboxExecutionAllowed,
    hardOutputLimit,
    supportedPlatforms: SUPPORTED_PLATFORMS,
    environmentAllowlist: MINIMAL_ENVIRONMENT_ALLOWLIST,
    blockedEnvironmentVariables: BLOCKED_ENVIRONMENT_VARIABLES,
    capabilities: BASE_CAPABILITIES
  });
}

const PROFILE_DEFINITIONS = Object.freeze([
  createProfile({
    profileId: "node.test",
    description:
      "Run the repository's fixed npm test entry point.",
    executableIdentity: EXECUTABLE_IDENTITIES.NODE_PACKAGE_MANAGER,
    fixedArguments: ["test"],
    executionTarget: EXECUTION_TARGETS.SOURCE_OR_SANDBOX,
    workingDirectoryPolicy:
      WORKING_DIRECTORY_POLICIES.APPROVED_BOUNDARY,
    riskClass: PROFILE_RISK_CLASSES.VALIDATION,
    timeoutMs: 600_000,
    sourceExecutionAllowed: true,
    sandboxExecutionAllowed: true
  }),

  createProfile({
    profileId: "node.lint",
    description:
      "Run the fixed repository lint script without autofix arguments.",
    executableIdentity: EXECUTABLE_IDENTITIES.NODE_PACKAGE_MANAGER,
    fixedArguments: ["run", "lint"],
    executionTarget: EXECUTION_TARGETS.SOURCE_OR_SANDBOX,
    workingDirectoryPolicy:
      WORKING_DIRECTORY_POLICIES.APPROVED_BOUNDARY,
    riskClass: PROFILE_RISK_CLASSES.VALIDATION,
    timeoutMs: 300_000,
    sourceExecutionAllowed: true,
    sandboxExecutionAllowed: true
  }),

  createProfile({
    profileId: "node.typecheck",
    description:
      "Run the fixed repository typecheck script.",
    executableIdentity: EXECUTABLE_IDENTITIES.NODE_PACKAGE_MANAGER,
    fixedArguments: ["run", "typecheck"],
    executionTarget: EXECUTION_TARGETS.SOURCE_OR_SANDBOX,
    workingDirectoryPolicy:
      WORKING_DIRECTORY_POLICIES.APPROVED_BOUNDARY,
    riskClass: PROFILE_RISK_CLASSES.VALIDATION,
    timeoutMs: 300_000,
    sourceExecutionAllowed: true,
    sandboxExecutionAllowed: true
  }),

  createProfile({
    profileId: "node.build",
    description:
      "Run the fixed repository build script inside an approved sandbox.",
    executableIdentity: EXECUTABLE_IDENTITIES.NODE_PACKAGE_MANAGER,
    fixedArguments: ["run", "build"],
    executionTarget: EXECUTION_TARGETS.SANDBOX,
    workingDirectoryPolicy:
      WORKING_DIRECTORY_POLICIES.SANDBOX_ROOT,
    riskClass:
      PROFILE_RISK_CLASSES.WRITE_CAPABLE_SANDBOX_ONLY,
    timeoutMs: 600_000,
    sourceExecutionAllowed: false,
    sandboxExecutionAllowed: true
  }),

  createProfile({
    profileId: "git.diff-check",
    description:
      "Inspect whitespace errors and unresolved conflict markers.",
    executableIdentity: EXECUTABLE_IDENTITIES.GIT,
    fixedArguments: ["diff", "--check"],
    executionTarget: EXECUTION_TARGETS.SOURCE_OR_SANDBOX,
    workingDirectoryPolicy:
      WORKING_DIRECTORY_POLICIES.APPROVED_BOUNDARY,
    riskClass: PROFILE_RISK_CLASSES.READ_ONLY,
    timeoutMs: 30_000,
    requiresGitClassification: true,
    requiredGitClassification: "READ_ONLY",
    sourceExecutionAllowed: true,
    sandboxExecutionAllowed: true
  }),

  createProfile({
    profileId: "git.status-porcelain",
    description:
      "Inspect repository state using stable porcelain version 2 output.",
    executableIdentity: EXECUTABLE_IDENTITIES.GIT,
    fixedArguments: ["status", "--porcelain=v2"],
    executionTarget: EXECUTION_TARGETS.SOURCE_OR_SANDBOX,
    workingDirectoryPolicy:
      WORKING_DIRECTORY_POLICIES.APPROVED_BOUNDARY,
    riskClass: PROFILE_RISK_CLASSES.READ_ONLY,
    timeoutMs: 30_000,
    requiresGitClassification: true,
    requiredGitClassification: "READ_ONLY",
    sourceExecutionAllowed: true,
    sandboxExecutionAllowed: true
  }),

  createProfile({
    profileId: "repository.quality-gates",
    description:
      "Run the repository's fixed internal quality-gate entry point.",
    executableIdentity: EXECUTABLE_IDENTITIES.NODE_PACKAGE_MANAGER,
    fixedArguments: ["test"],
    executionTarget: EXECUTION_TARGETS.SOURCE_OR_SANDBOX,
    workingDirectoryPolicy:
      WORKING_DIRECTORY_POLICIES.APPROVED_BOUNDARY,
    riskClass: PROFILE_RISK_CLASSES.VALIDATION,
    timeoutMs: 600_000,
    maxStdoutBytes: 2_097_152,
    maxStderrBytes: 2_097_152,
    sourceExecutionAllowed: true,
    sandboxExecutionAllowed: true
  })
]);

const PROFILE_MAP = new Map(
  PROFILE_DEFINITIONS.map((profile) => [
    profile.profileId,
    profile
  ])
);

function normalizeProfileId(profileId) {
  if (typeof profileId !== "string") {
    return null;
  }

  const normalized = profileId.trim();

  if (
    normalized.length === 0 ||
    normalized.length > 128 ||
    normalized !== profileId
  ) {
    return null;
  }

  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u.test(normalized)) {
    return null;
  }

  return normalized;
}

export function getProcessProfile(profileId) {
  const normalizedProfileId = normalizeProfileId(profileId);

  if (normalizedProfileId === null) {
    return null;
  }

  return PROFILE_MAP.get(normalizedProfileId) ?? null;
}

export function hasProcessProfile(profileId) {
  return getProcessProfile(profileId) !== null;
}

export function listProcessProfiles() {
  return PROFILE_DEFINITIONS;
}

export function listProcessProfileIds() {
  return Object.freeze(
    PROFILE_DEFINITIONS.map((profile) => profile.profileId)
  );
}

export const PROCESS_PROFILE_REGISTRY_CAPABILITIES = Object.freeze({
  schemaVersion: PROFILE_SCHEMA_VERSION,
  policyVersion: PROFILE_POLICY_VERSION,
  profileCount: PROFILE_DEFINITIONS.length,
  approvedProfileIds: listProcessProfileIds(),
  supportedPlatforms: SUPPORTED_PLATFORMS,
  executionTargets: EXECUTION_TARGETS,
  workingDirectoryPolicies: WORKING_DIRECTORY_POLICIES,
  riskClasses: PROFILE_RISK_CLASSES,
  shellStringsAccepted: false,
  arbitraryExecutablesAccepted: false,
  arbitraryArgumentsAccepted: false,
  arbitraryEnvironmentAccepted: false,
  networkAllowedByDefault: false,
  sourceWriteAuthorityGranted: false,
  gitWriteAuthorityGranted: false,
  dependencyMutationAuthorityGranted: false,
  detachedProcessesAllowed: false,
  maximumArguments: MAX_ARGUMENTS,
  maximumArgumentBytes: MAX_ARGUMENT_BYTES,
  maximumTimeoutMs: MAX_TIMEOUT_MS,
  defaultStdoutLimitBytes: DEFAULT_STDOUT_LIMIT_BYTES,
  defaultStderrLimitBytes: DEFAULT_STDERR_LIMIT_BYTES
});

export {
  BLOCKED_ENVIRONMENT_VARIABLES,
  EXECUTABLE_IDENTITIES,
  EXECUTION_TARGETS,
  MINIMAL_ENVIRONMENT_ALLOWLIST,
  PROFILE_POLICY_VERSION,
  PROFILE_RISK_CLASSES,
  PROFILE_SCHEMA_VERSION,
  SUPPORTED_PLATFORMS,
  WORKING_DIRECTORY_POLICIES
};
