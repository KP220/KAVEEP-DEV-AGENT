import { createHash } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import path from "node:path";

import {
  EXECUTION_TARGETS,
  PROCESS_PROFILE_REGISTRY_CAPABILITIES,
  PROFILE_POLICY_VERSION,
  getProcessProfile
} from "./process-profile-registry.mjs";

const REQUEST_SCHEMA_VERSION = "1.0.0";

const AUTHORIZATION_STATES = Object.freeze({
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  BLOCKED: "BLOCKED",
  UNSUPPORTED: "UNSUPPORTED",
  UNVERIFIED: "UNVERIFIED"
});

const REQUEST_EXECUTION_TARGETS = Object.freeze([
  EXECUTION_TARGETS.SOURCE,
  EXECUTION_TARGETS.SANDBOX
]);

const REQUIRED_REQUEST_FIELDS = Object.freeze([
  "schemaVersion",
  "requestId",
  "profileId",
  "arguments",
  "workingDirectory",
  "repositoryRoot",
  "executionTarget",
  "authoritySnapshotId",
  "policyVersion",
  "correlationId"
]);

const OPTIONAL_REQUEST_FIELDS = Object.freeze([
  "sandboxRoot"
]);

const ALLOWED_REQUEST_FIELDS = Object.freeze([
  ...REQUIRED_REQUEST_FIELDS,
  ...OPTIONAL_REQUEST_FIELDS
]);

const PROHIBITED_REQUEST_FIELDS = Object.freeze([
  "command",
  "commandLine",
  "shellCommand",
  "shell",
  "executable",
  "executablePath",
  "environment",
  "env",
  "timeout",
  "timeoutMs",
  "maxStdoutBytes",
  "maxStderrBytes",
  "networkAllowed",
  "sourceWriteAllowed",
  "gitWriteAllowed",
  "dependencyMutationAllowed",
  "detached",
  "detachedProcess",
  "stdio",
  "uid",
  "gid"
]);

const IDENTIFIER_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

const PROFILE_ID_PATTERN =
  /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;

const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u001F\u007F]/u;

const SHELL_META_PATTERN =
  /[;&|`$<>\r\n]/u;

function freezeArray(values) {
  return Object.freeze([...values]);
}

function freezeObject(value) {
  return Object.freeze({
    ...value
  });
}

function createDecision({
  classification,
  reason,
  executed = false,
  normalizedRequest = null,
  profile = null,
  evidence = {}
}) {
  return Object.freeze({
    schemaVersion: REQUEST_SCHEMA_VERSION,
    classification,
    reason,
    executed,
    normalizedRequest,
    profile,
    evidence: freezeObject(evidence),
    capabilities:
      PROCESS_REQUEST_VALIDATOR_CAPABILITIES
  });
}

function reject(reason, evidence = {}) {
  return createDecision({
    classification: AUTHORIZATION_STATES.REJECTED,
    reason,
    evidence
  });
}

function block(reason, evidence = {}) {
  return createDecision({
    classification: AUTHORIZATION_STATES.BLOCKED,
    reason,
    evidence
  });
}

function approve(normalizedRequest, profile, evidence) {
  return createDecision({
    classification: AUTHORIZATION_STATES.APPROVED,
    reason: "request_approved",
    normalizedRequest,
    profile,
    evidence
  });
}

function isPlainObject(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function validateExactFields(request) {
  for (const field of PROHIBITED_REQUEST_FIELDS) {
    if (hasOwn(request, field)) {
      return block("prohibited_request_field", {
        field
      });
    }
  }

  for (const field of REQUIRED_REQUEST_FIELDS) {
    if (!hasOwn(request, field)) {
      return reject("missing_required_field", {
        field
      });
    }
  }

  for (const field of Object.keys(request)) {
    if (!ALLOWED_REQUEST_FIELDS.includes(field)) {
      return reject("unknown_request_field", {
        field
      });
    }
  }

  return null;
}

function validateIdentifier(value, field) {
  if (
    typeof value !== "string" ||
    !IDENTIFIER_PATTERN.test(value)
  ) {
    return reject("invalid_identifier", {
      field
    });
  }

  return null;
}

function validateProfileId(profileId) {
  if (
    typeof profileId !== "string" ||
    !PROFILE_ID_PATTERN.test(profileId)
  ) {
    return reject("invalid_profile_id");
  }

  return null;
}

function validateArgument(argument, index, profile) {
  if (typeof argument !== "string") {
    return reject("argument_must_be_string", {
      index
    });
  }

  const byteLength = Buffer.byteLength(argument, "utf8");

  if (byteLength === 0) {
    return reject("argument_must_not_be_empty", {
      index
    });
  }

  if (byteLength > profile.maxArgumentBytes) {
    return reject("argument_exceeds_byte_limit", {
      index,
      byteLength,
      maximumBytes: profile.maxArgumentBytes
    });
  }

  if (CONTROL_CHARACTER_PATTERN.test(argument)) {
    return block("argument_contains_control_character", {
      index
    });
  }

  if (SHELL_META_PATTERN.test(argument)) {
    return block("argument_contains_shell_metacharacter", {
      index
    });
  }

  return null;
}

function validateArguments(argumentsValue, profile) {
  if (!Array.isArray(argumentsValue)) {
    return reject("arguments_must_be_array");
  }

  if (argumentsValue.length > profile.maxArguments) {
    return reject("argument_count_exceeds_limit", {
      count: argumentsValue.length,
      maximum: profile.maxArguments
    });
  }

  for (
    let index = 0;
    index < argumentsValue.length;
    index += 1
  ) {
    const validationResult = validateArgument(
      argumentsValue[index],
      index,
      profile
    );

    if (validationResult !== null) {
      return validationResult;
    }
  }

  if (
    argumentsValue.length >
    profile.allowedAdditionalArguments.length
  ) {
    return block("additional_arguments_not_allowed", {
      suppliedArguments: argumentsValue.length,
      allowedArguments:
        profile.allowedAdditionalArguments.length
    });
  }

  for (
    let index = 0;
    index < argumentsValue.length;
    index += 1
  ) {
    if (
      argumentsValue[index] !==
      profile.allowedAdditionalArguments[index]
    ) {
      return block("additional_argument_not_allowlisted", {
        index
      });
    }
  }

  return null;
}

function isAbsolutePath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    path.isAbsolute(value)
  );
}

function canonicalizeDirectory(directoryPath, field) {
  if (!isAbsolutePath(directoryPath)) {
    return {
      error: reject("path_must_be_absolute", {
        field
      })
    };
  }

  if (CONTROL_CHARACTER_PATTERN.test(directoryPath)) {
    return {
      error: block("path_contains_control_character", {
        field
      })
    };
  }

  try {
    const canonicalPath = realpathSync.native(directoryPath);
    const stats = statSync(canonicalPath);

    if (!stats.isDirectory()) {
      return {
        error: reject("path_must_reference_directory", {
          field
        })
      };
    }

    return {
      value: canonicalPath
    };
  } catch {
    return {
      error: reject("path_cannot_be_canonicalized", {
        field
      })
    };
  }
}

function normalizeForComparison(value) {
  const normalized = path.normalize(value);

  if (process.platform === "win32") {
    return normalized.toLowerCase();
  }

  return normalized;
}

function isPathContained(parentPath, candidatePath) {
  const normalizedParent =
    normalizeForComparison(parentPath);

  const normalizedCandidate =
    normalizeForComparison(candidatePath);

  const relative = path.relative(
    normalizedParent,
    normalizedCandidate
  );

  return (
    relative === "" ||
    (
      !relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative)
    )
  );
}

function validateExecutionTarget(request, profile) {
  if (
    typeof request.executionTarget !== "string" ||
    !REQUEST_EXECUTION_TARGETS.includes(
      request.executionTarget
    )
  ) {
    return reject("invalid_execution_target");
  }

  if (
    request.executionTarget ===
      EXECUTION_TARGETS.SOURCE &&
    profile.sourceExecutionAllowed !== true
  ) {
    return block(
      "profile_not_authorized_for_source_execution"
    );
  }

  if (
    request.executionTarget ===
      EXECUTION_TARGETS.SANDBOX &&
    profile.sandboxExecutionAllowed !== true
  ) {
    return block(
      "profile_not_authorized_for_sandbox_execution"
    );
  }

  if (
    profile.executionTarget ===
      EXECUTION_TARGETS.SOURCE &&
    request.executionTarget !==
      EXECUTION_TARGETS.SOURCE
  ) {
    return block("profile_requires_source_target");
  }

  if (
    profile.executionTarget ===
      EXECUTION_TARGETS.SANDBOX &&
    request.executionTarget !==
      EXECUTION_TARGETS.SANDBOX
  ) {
    return block("profile_requires_sandbox_target");
  }

  return null;
}

function validateBoundaries(request) {
  const repositoryResult = canonicalizeDirectory(
    request.repositoryRoot,
    "repositoryRoot"
  );

  if (repositoryResult.error) {
    return repositoryResult;
  }

  const workingDirectoryResult =
    canonicalizeDirectory(
      request.workingDirectory,
      "workingDirectory"
    );

  if (workingDirectoryResult.error) {
    return workingDirectoryResult;
  }

  let sandboxRoot = null;

  if (
    request.sandboxRoot !== undefined &&
    request.sandboxRoot !== null
  ) {
    const sandboxResult = canonicalizeDirectory(
      request.sandboxRoot,
      "sandboxRoot"
    );

    if (sandboxResult.error) {
      return sandboxResult;
    }

    sandboxRoot = sandboxResult.value;
  }

  if (
    request.executionTarget ===
    EXECUTION_TARGETS.SOURCE
  ) {
    if (
      !isPathContained(
        repositoryResult.value,
        workingDirectoryResult.value
      )
    ) {
      return {
        error: block(
          "working_directory_outside_repository"
        )
      };
    }
  }

  if (
    request.executionTarget ===
    EXECUTION_TARGETS.SANDBOX
  ) {
    if (sandboxRoot === null) {
      return {
        error: reject(
          "sandbox_root_required_for_sandbox_execution"
        )
      };
    }

    if (
      !isPathContained(
        sandboxRoot,
        workingDirectoryResult.value
      )
    ) {
      return {
        error: block(
          "working_directory_outside_sandbox"
        )
      };
    }
  }

  return {
    repositoryRoot: repositoryResult.value,
    workingDirectory: workingDirectoryResult.value,
    sandboxRoot
  };
}

function createRequestHash(normalizedRequest) {
  const canonicalPayload = JSON.stringify({
    schemaVersion: normalizedRequest.schemaVersion,
    requestId: normalizedRequest.requestId,
    profileId: normalizedRequest.profileId,
    arguments: normalizedRequest.arguments,
    workingDirectory:
      normalizedRequest.workingDirectory,
    repositoryRoot: normalizedRequest.repositoryRoot,
    sandboxRoot: normalizedRequest.sandboxRoot,
    executionTarget:
      normalizedRequest.executionTarget,
    authoritySnapshotId:
      normalizedRequest.authoritySnapshotId,
    policyVersion: normalizedRequest.policyVersion,
    correlationId: normalizedRequest.correlationId
  });

  return createHash("sha256")
    .update(canonicalPayload, "utf8")
    .digest("hex");
}

function freezeNormalizedRequest(request) {
  return Object.freeze({
    ...request,
    arguments: freezeArray(request.arguments)
  });
}

export function validateProcessRequest(request) {
  if (!isPlainObject(request)) {
    return reject("request_must_be_plain_object");
  }

  const fieldValidation = validateExactFields(request);

  if (fieldValidation !== null) {
    return fieldValidation;
  }

  if (
    request.schemaVersion !==
    REQUEST_SCHEMA_VERSION
  ) {
    return reject("unsupported_request_schema_version", {
      suppliedVersion: request.schemaVersion,
      supportedVersion: REQUEST_SCHEMA_VERSION
    });
  }

  const requestIdValidation = validateIdentifier(
    request.requestId,
    "requestId"
  );

  if (requestIdValidation !== null) {
    return requestIdValidation;
  }

  const correlationIdValidation =
    validateIdentifier(
      request.correlationId,
      "correlationId"
    );

  if (correlationIdValidation !== null) {
    return correlationIdValidation;
  }

  const authorityValidation = validateIdentifier(
    request.authoritySnapshotId,
    "authoritySnapshotId"
  );

  if (authorityValidation !== null) {
    return authorityValidation;
  }

  const profileIdValidation = validateProfileId(
    request.profileId
  );

  if (profileIdValidation !== null) {
    return profileIdValidation;
  }

  if (
    request.policyVersion !==
    PROFILE_POLICY_VERSION
  ) {
    return reject("policy_version_mismatch", {
      suppliedVersion: request.policyVersion,
      requiredVersion: PROFILE_POLICY_VERSION
    });
  }

  const profile = getProcessProfile(
    request.profileId
  );

  if (profile === null) {
    return reject("unknown_process_profile", {
      profileId: request.profileId
    });
  }

  if (
    !profile.supportedPlatforms.includes(
      process.platform
    )
  ) {
    return createDecision({
      classification:
        AUTHORIZATION_STATES.UNSUPPORTED,
      reason: "platform_not_supported",
      profile,
      evidence: {
        platform: process.platform
      }
    });
  }

  const targetValidation =
    validateExecutionTarget(request, profile);

  if (targetValidation !== null) {
    return targetValidation;
  }

  const argumentValidation = validateArguments(
    request.arguments,
    profile
  );

  if (argumentValidation !== null) {
    return argumentValidation;
  }

  const boundaryResult =
    validateBoundaries(request);

  if (boundaryResult.error) {
    return boundaryResult.error;
  }

  const normalizedRequest =
    freezeNormalizedRequest({
      schemaVersion: REQUEST_SCHEMA_VERSION,
      requestId: request.requestId,
      profileId: profile.profileId,
      arguments: [...request.arguments],
      workingDirectory:
        boundaryResult.workingDirectory,
      repositoryRoot:
        boundaryResult.repositoryRoot,
      sandboxRoot:
        boundaryResult.sandboxRoot,
      executionTarget:
        request.executionTarget,
      authoritySnapshotId:
        request.authoritySnapshotId,
      policyVersion:
        request.policyVersion,
      correlationId:
        request.correlationId
    });

  const requestHash =
    createRequestHash(normalizedRequest);

  return approve(
    normalizedRequest,
    profile,
    {
      requestHash,
      platform: process.platform,
      profilePolicyVersion:
        profile.policyVersion,
      shellAllowed:
        profile.capabilities.shellAllowed,
      networkAllowed:
        profile.capabilities.networkAllowed,
      sourceWriteAuthorityGranted:
        profile.capabilities
          .sourceWriteAuthorityGranted,
      gitWriteAuthorityGranted:
        profile.capabilities
          .gitWriteAuthorityGranted,
      dependencyMutationAuthorityGranted:
        profile.capabilities
          .dependencyMutationAuthorityGranted
    }
  );
}

export const PROCESS_REQUEST_VALIDATOR_CAPABILITIES =
  Object.freeze({
    schemaVersion: REQUEST_SCHEMA_VERSION,
    policyVersion: PROFILE_POLICY_VERSION,
    authorizationStates:
      AUTHORIZATION_STATES,
    requiredFields:
      REQUIRED_REQUEST_FIELDS,
    optionalFields:
      OPTIONAL_REQUEST_FIELDS,
    prohibitedFields:
      PROHIBITED_REQUEST_FIELDS,
    requestExecutionTargets:
      REQUEST_EXECUTION_TARGETS,
    plainObjectsOnly: true,
    exactFieldsRequired: true,
    shellStringsAccepted: false,
    arbitraryExecutableAccepted: false,
    arbitraryArgumentsAccepted: false,
    arbitraryEnvironmentAccepted: false,
    arbitraryTimeoutAccepted: false,
    arbitraryOutputLimitsAccepted: false,
    relativePathsAccepted: false,
    pathCanonicalizationRequired: true,
    pathContainmentRequired: true,
    unknownProfilesFailClosed: true,
    unknownFieldsFailClosed: true,
    requestHashAlgorithm: "sha256"
  });

export {
  AUTHORIZATION_STATES,
  REQUEST_SCHEMA_VERSION
};
