import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

import {
  EXECUTABLE_IDENTITIES,
  PROCESS_PROFILE_REGISTRY_CAPABILITIES
} from "./process-profile-registry.mjs";

import {
  AUTHORIZATION_STATES,
  validateProcessRequest
} from "./process-request-validator.mjs";

import {
  classifyGitOperation
} from "../git/git-operation-classifier.mjs";

const RESULT_SCHEMA_VERSION = "1.0.0";

const RESULT_STATUSES = Object.freeze({
  REJECTED: "rejected",
  COMPLETED: "completed",
  FAILED: "failed",
  TIMED_OUT: "timed_out",
  TERMINATED: "terminated",
  RUNTIME_UNAVAILABLE: "runtime_unavailable",
  INTERNAL_ERROR: "internal_error"
});

const TERMINATION_STATES = Object.freeze({
  NOT_REQUIRED: "NOT_REQUIRED",
  REQUESTED: "REQUESTED",
  CONFIRMED: "CONFIRMED",
  UNVERIFIED: "UNVERIFIED"
});

const NETWORK_ENFORCEMENT_STATES = Object.freeze({
  ENFORCED: "ENFORCED",
  UNVERIFIED: "UNVERIFIED"
});

const REDACTION_PATTERNS = Object.freeze([
  {
    name: "openai_style_key",
    pattern: /\bsk-[A-Za-z0-9_-]{8,}\b/gu
  },
  {
    name: "bearer_token",
    pattern:
      /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/giu
  },
  {
    name: "private_key",
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu
  },
  {
    name: "generic_secret_assignment",
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*["']?[^\s"',;]{8,}["']?/giu
  }
]);

const TERMINATION_GRACE_MS = 1_500;

function freezeArray(values) {
  return Object.freeze([...values]);
}

function freezeObject(value) {
  return Object.freeze({
    ...value
  });
}

function freezeResult(result) {
  return Object.freeze({
    ...result,
    limitations: freezeArray(result.limitations),
    evidence: freezeObject(result.evidence),
    capabilities: CONTROLLED_PROCESS_RUNNER_CAPABILITIES
  });
}

function nowIso() {
  return new Date().toISOString();
}

function createRejectedResult(decision) {
  return freezeResult({
    schemaVersion: RESULT_SCHEMA_VERSION,
    requestId:
      decision.normalizedRequest?.requestId ?? null,
    profileId:
      decision.normalizedRequest?.profileId ?? null,
    status: RESULT_STATUSES.REJECTED,
    classification: decision.classification,
    reason: decision.reason,
    executed: false,
    startedAt: null,
    completedAt: nowIso(),
    durationMs: 0,
    exitCode: null,
    signal: null,
    timedOut: false,
    outputLimitExceeded: false,
    stdout: "",
    stderr: "",
    stdoutBytes: 0,
    stderrBytes: 0,
    stdoutTruncated: false,
    stderrTruncated: false,
    workingDirectory:
      decision.normalizedRequest?.workingDirectory ??
      null,
    repositoryRoot:
      decision.normalizedRequest?.repositoryRoot ??
      null,
    sandboxRoot:
      decision.normalizedRequest?.sandboxRoot ?? null,
    executionTarget:
      decision.normalizedRequest?.executionTarget ??
      null,
    networkAllowed: false,
    networkEnforcement:
      NETWORK_ENFORCEMENT_STATES.UNVERIFIED,
    shellAllowed: false,
    sourceWriteAuthorityGranted: false,
    gitWriteAuthorityGranted: false,
    dependencyMutationAuthorityGranted: false,
    terminationStatus:
      TERMINATION_STATES.NOT_REQUIRED,
    limitations: [],
    evidence: {
      authorizationReason: decision.reason,
      authorizationEvidence: decision.evidence
    }
  });
}

function redactText(value) {
  let redactedValue = value;
  let redactionCount = 0;

  for (const definition of REDACTION_PATTERNS) {
    redactedValue = redactedValue.replace(
      definition.pattern,
      () => {
        redactionCount += 1;
        return "[REDACTED]";
      }
    );
  }

  return {
    value: redactedValue,
    redactionCount
  };
}

function resolveExecutable(executableIdentity) {
  if (
    executableIdentity ===
    EXECUTABLE_IDENTITIES.NODE_PACKAGE_MANAGER
  ) {
    return {
      executable:
        process.platform === "win32"
          ? "npm.cmd"
          : "npm",
      identity: "npm",
      supported: true
    };
  }

  if (
    executableIdentity ===
    EXECUTABLE_IDENTITIES.GIT
  ) {
    return {
      executable: "git",
      identity: "git",
      supported: true
    };
  }

  return {
    executable: null,
    identity: executableIdentity,
    supported: false
  };
}

function buildMinimalEnvironment(profile) {
  const environment = {};

  for (const variableName of profile.environmentAllowlist) {
    if (
      profile.blockedEnvironmentVariables.includes(
        variableName
      )
    ) {
      continue;
    }

    const value = process.env[variableName];

    if (typeof value === "string") {
      environment[variableName] = value;
    }
  }

  environment.NO_COLOR = "1";
  environment.FORCE_COLOR = "0";

  if (
    profile.executableIdentity ===
    EXECUTABLE_IDENTITIES.GIT
  ) {
    environment.GIT_TERMINAL_PROMPT = "0";
    environment.GIT_CONFIG_NOSYSTEM = "1";
    environment.GIT_OPTIONAL_LOCKS = "0";
  }

  if (
    profile.executableIdentity ===
    EXECUTABLE_IDENTITIES.NODE_PACKAGE_MANAGER
  ) {
    environment.NPM_CONFIG_AUDIT = "false";
    environment.NPM_CONFIG_FUND = "false";
    environment.NPM_CONFIG_UPDATE_NOTIFIER = "false";
    environment.NPM_CONFIG_PROGRESS = "false";
  }

  return environment;
}

function validateGitCorrelation(
  normalizedRequest,
  profile
) {
  if (profile.requiresGitClassification !== true) {
    return {
      approved: true,
      result: null
    };
  }

  const gitInvocation = [
    ...profile.fixedArguments,
    ...normalizedRequest.arguments
  ];

  const [gitCommand, ...gitArguments] =
    gitInvocation;

  if (
    typeof gitCommand !== "string" ||
    gitCommand.length === 0
  ) {
    return {
      approved: false,
      result: Object.freeze({
        classification: "BLOCKED",
        command: "",
        normalizedArguments: Object.freeze([]),
        networkAllowed: false,
        shellAllowed: false,
        writeAuthorityGranted: false,
        reason:
          "Git profile did not produce a valid subcommand.",
        limitations: Object.freeze([
          "The operation was not executed.",
          "Classification is fail-closed."
        ])
      })
    };
  }

  const classificationResult =
    classifyGitOperation({
      command: gitCommand,
      arguments: gitArguments
    });

  if (
    classificationResult.classification !==
    profile.requiredGitClassification
  ) {
    return {
      approved: false,
      result: classificationResult
    };
  }

  return {
    approved: true,
    result: classificationResult
  };
}

function appendBoundedChunk({
  chunk,
  retainedChunks,
  observedBytes,
  retainedBytes,
  limitBytes
}) {
  const buffer = Buffer.isBuffer(chunk)
    ? chunk
    : Buffer.from(chunk);

  const nextObservedBytes =
    observedBytes + buffer.length;

  if (retainedBytes >= limitBytes) {
    return {
      observedBytes: nextObservedBytes,
      retainedBytes,
      truncated: true,
      limitExceeded: true
    };
  }

  const remainingBytes =
    limitBytes - retainedBytes;

  const retainedChunk =
    buffer.length <= remainingBytes
      ? buffer
      : buffer.subarray(0, remainingBytes);

  if (retainedChunk.length > 0) {
    retainedChunks.push(retainedChunk);
  }

  const nextRetainedBytes =
    retainedBytes + retainedChunk.length;

  return {
    observedBytes: nextObservedBytes,
    retainedBytes: nextRetainedBytes,
    truncated:
      retainedChunk.length < buffer.length,
    limitExceeded:
      nextObservedBytes > limitBytes
  };
}

function decodeChunks(chunks) {
  return Buffer.concat(chunks).toString("utf8");
}

function requestTermination(child, signal) {
  if (
    child === null ||
    child.killed === true ||
    child.exitCode !== null
  ) {
    return false;
  }

  try {
    return child.kill(signal);
  } catch {
    return false;
  }
}

function waitForClose(child) {
  return new Promise((resolve) => {
    child.once("close", (exitCode, signal) => {
      resolve({
        exitCode,
        signal
      });
    });
  });
}

function spawnControlledProcess({
  executable,
  arguments: processArguments,
  profile,
  request
}) {
  return new Promise((resolve) => {
    const startedAt = nowIso();
    const startedMonotonic = performance.now();

    let child;

    try {
      child = spawn(
        executable,
        processArguments,
        {
          cwd: request.workingDirectory,
          env: buildMinimalEnvironment(profile),
          shell: false,
          detached: false,
          windowsHide: true,
          stdio: [
            "ignore",
            "pipe",
            "pipe"
          ]
        }
      );
    } catch (error) {
      resolve({
        spawnError: error,
        startedAt,
        durationMs:
          Math.max(
            0,
            Math.round(
              performance.now() -
                startedMonotonic
            )
          )
      });
      return;
    }

    const stdoutChunks = [];
    const stderrChunks = [];

    let stdoutObservedBytes = 0;
    let stderrObservedBytes = 0;
    let stdoutRetainedBytes = 0;
    let stderrRetainedBytes = 0;
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let outputLimitExceeded = false;
    let timedOut = false;
    let terminationRequested = false;
    let terminationEscalated = false;
    let spawnError = null;

    const requestProcessTermination = () => {
      if (terminationRequested) {
        return;
      }

      terminationRequested = true;

      requestTermination(child, "SIGTERM");

      setTimeout(() => {
        if (
          child.exitCode === null &&
          child.signalCode === null
        ) {
          terminationEscalated = true;
          requestTermination(child, "SIGKILL");
        }
      }, TERMINATION_GRACE_MS).unref();
    };

    child.on("error", (error) => {
      spawnError = error;
    });

    child.stdout.on("data", (chunk) => {
      const result = appendBoundedChunk({
        chunk,
        retainedChunks: stdoutChunks,
        observedBytes: stdoutObservedBytes,
        retainedBytes: stdoutRetainedBytes,
        limitBytes: profile.maxStdoutBytes
      });

      stdoutObservedBytes =
        result.observedBytes;

      stdoutRetainedBytes =
        result.retainedBytes;

      stdoutTruncated =
        stdoutTruncated || result.truncated;

      if (result.limitExceeded) {
        outputLimitExceeded = true;

        if (profile.hardOutputLimit === true) {
          requestProcessTermination();
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      const result = appendBoundedChunk({
        chunk,
        retainedChunks: stderrChunks,
        observedBytes: stderrObservedBytes,
        retainedBytes: stderrRetainedBytes,
        limitBytes: profile.maxStderrBytes
      });

      stderrObservedBytes =
        result.observedBytes;

      stderrRetainedBytes =
        result.retainedBytes;

      stderrTruncated =
        stderrTruncated || result.truncated;

      if (result.limitExceeded) {
        outputLimitExceeded = true;

        if (profile.hardOutputLimit === true) {
          requestProcessTermination();
        }
      }
    });

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      requestProcessTermination();
    }, profile.timeoutMs);

    timeoutHandle.unref();

    waitForClose(child).then(
      ({ exitCode, signal }) => {
        clearTimeout(timeoutHandle);

        const completedAt = nowIso();

        const durationMs =
          Math.max(
            0,
            Math.round(
              performance.now() -
                startedMonotonic
            )
          );

        resolve({
          childPid: child.pid ?? null,
          startedAt,
          completedAt,
          durationMs,
          exitCode,
          signal,
          timedOut,
          outputLimitExceeded,
          stdout: decodeChunks(stdoutChunks),
          stderr: decodeChunks(stderrChunks),
          stdoutBytes: stdoutObservedBytes,
          stderrBytes: stderrObservedBytes,
          stdoutTruncated,
          stderrTruncated,
          terminationRequested,
          terminationEscalated,
          spawnError
        });
      }
    );
  });
}

function determineStatus({
  execution,
  profile
}) {
  if (execution.spawnError !== null) {
    if (
      execution.spawnError.code === "ENOENT"
    ) {
      return RESULT_STATUSES.RUNTIME_UNAVAILABLE;
    }

    return RESULT_STATUSES.FAILED;
  }

  if (execution.timedOut) {
    return RESULT_STATUSES.TIMED_OUT;
  }

  if (
    execution.outputLimitExceeded &&
    execution.terminationRequested
  ) {
    return RESULT_STATUSES.TERMINATED;
  }

  if (
    !profile.acceptedExitCodes.includes(
      execution.exitCode
    )
  ) {
    return RESULT_STATUSES.FAILED;
  }

  return RESULT_STATUSES.COMPLETED;
}

function determineTerminationStatus(execution) {
  if (!execution.terminationRequested) {
    return TERMINATION_STATES.NOT_REQUIRED;
  }

  if (
    execution.exitCode !== null ||
    execution.signal !== null
  ) {
    return TERMINATION_STATES.CONFIRMED;
  }

  return TERMINATION_STATES.UNVERIFIED;
}

function createExecutionResult({
  decision,
  execution,
  executableResolution,
  gitCorrelation
}) {
  const profile = decision.profile;
  const request = decision.normalizedRequest;

  if (execution.spawnError !== null) {
    const errorMessage =
      typeof execution.spawnError.message ===
      "string"
        ? execution.spawnError.message
        : "Process spawn failed.";

    const redactedError =
      redactText(errorMessage);

    return freezeResult({
      schemaVersion: RESULT_SCHEMA_VERSION,
      requestId: request.requestId,
      profileId: profile.profileId,
      status:
        execution.spawnError.code === "ENOENT"
          ? RESULT_STATUSES.RUNTIME_UNAVAILABLE
          : RESULT_STATUSES.FAILED,
      classification:
        AUTHORIZATION_STATES.APPROVED,
      reason:
        execution.spawnError.code === "ENOENT"
          ? "executable_unavailable"
          : "process_spawn_failed",
      executed: false,
      startedAt: execution.startedAt,
      completedAt: nowIso(),
      durationMs: execution.durationMs,
      exitCode: null,
      signal: null,
      timedOut: false,
      outputLimitExceeded: false,
      stdout: "",
      stderr: redactedError.value,
      stdoutBytes: 0,
      stderrBytes: Buffer.byteLength(
        redactedError.value,
        "utf8"
      ),
      stdoutTruncated: false,
      stderrTruncated: false,
      workingDirectory:
        request.workingDirectory,
      repositoryRoot: request.repositoryRoot,
      sandboxRoot: request.sandboxRoot,
      executionTarget: request.executionTarget,
      networkAllowed: false,
      networkEnforcement:
        NETWORK_ENFORCEMENT_STATES.UNVERIFIED,
      shellAllowed: false,
      sourceWriteAuthorityGranted: false,
      gitWriteAuthorityGranted: false,
      dependencyMutationAuthorityGranted: false,
      terminationStatus:
        TERMINATION_STATES.NOT_REQUIRED,
      limitations: [
        "Network denial is policy-enforced but not technically isolated by the host runner."
      ],
      evidence: {
        requestHash:
          decision.evidence.requestHash,
        executableIdentity:
          executableResolution.identity,
        resolvedExecutable:
          executableResolution.executable,
        errorCode:
          execution.spawnError.code ?? null,
        redactionCount:
          redactedError.redactionCount,
        gitClassification:
          gitCorrelation.result
      }
    });
  }

  const redactedStdout =
    redactText(execution.stdout);

  const redactedStderr =
    redactText(execution.stderr);

  const status = determineStatus({
    execution,
    profile
  });

  const success =
    status === RESULT_STATUSES.COMPLETED;

  return freezeResult({
    schemaVersion: RESULT_SCHEMA_VERSION,
    requestId: request.requestId,
    profileId: profile.profileId,
    status,
    classification:
      AUTHORIZATION_STATES.APPROVED,
    reason: success
      ? "process_completed"
      : status === RESULT_STATUSES.TIMED_OUT
        ? "process_timed_out"
        : status === RESULT_STATUSES.TERMINATED
          ? "output_limit_exceeded"
          : "process_failed",
    executed: true,
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
    durationMs: execution.durationMs,
    exitCode: execution.exitCode,
    signal: execution.signal,
    timedOut: execution.timedOut,
    outputLimitExceeded:
      execution.outputLimitExceeded,
    stdout: redactedStdout.value,
    stderr: redactedStderr.value,
    stdoutBytes: execution.stdoutBytes,
    stderrBytes: execution.stderrBytes,
    stdoutTruncated:
      execution.stdoutTruncated,
    stderrTruncated:
      execution.stderrTruncated,
    workingDirectory:
      request.workingDirectory,
    repositoryRoot: request.repositoryRoot,
    sandboxRoot: request.sandboxRoot,
    executionTarget: request.executionTarget,
    networkAllowed: false,
    networkEnforcement:
      NETWORK_ENFORCEMENT_STATES.UNVERIFIED,
    shellAllowed: false,
    sourceWriteAuthorityGranted: false,
    gitWriteAuthorityGranted: false,
    dependencyMutationAuthorityGranted: false,
    terminationStatus:
      determineTerminationStatus(execution),
    limitations: [
      "Network denial is declared by policy but is not technically isolated by this host runner.",
      "Complete descendant-process termination is platform-dependent and is not guaranteed by this implementation."
    ],
    evidence: {
      requestHash:
        decision.evidence.requestHash,
      executableIdentity:
        executableResolution.identity,
      resolvedExecutable:
        executableResolution.executable,
      fixedArguments:
        freezeArray(profile.fixedArguments),
      additionalArguments:
        freezeArray(request.arguments),
      profilePolicyVersion:
        profile.policyVersion,
      authoritySnapshotId:
        request.authoritySnapshotId,
      correlationId:
        request.correlationId,
      gitClassification:
        gitCorrelation.result,
      terminationRequested:
        execution.terminationRequested,
      terminationEscalated:
        execution.terminationEscalated,
      redactionCount:
        redactedStdout.redactionCount +
        redactedStderr.redactionCount
    }
  });
}

export async function runControlledProcess(request) {
  let decision;

  try {
    decision = validateProcessRequest(request);
  } catch (error) {
    const redactedError = redactText(
      error instanceof Error
        ? error.message
        : String(error)
    );

    return freezeResult({
      schemaVersion: RESULT_SCHEMA_VERSION,
      requestId: null,
      profileId: null,
      status: RESULT_STATUSES.INTERNAL_ERROR,
      classification:
        AUTHORIZATION_STATES.UNVERIFIED,
      reason: "request_validation_internal_error",
      executed: false,
      startedAt: null,
      completedAt: nowIso(),
      durationMs: 0,
      exitCode: null,
      signal: null,
      timedOut: false,
      outputLimitExceeded: false,
      stdout: "",
      stderr: redactedError.value,
      stdoutBytes: 0,
      stderrBytes: Buffer.byteLength(
        redactedError.value,
        "utf8"
      ),
      stdoutTruncated: false,
      stderrTruncated: false,
      workingDirectory: null,
      repositoryRoot: null,
      sandboxRoot: null,
      executionTarget: null,
      networkAllowed: false,
      networkEnforcement:
        NETWORK_ENFORCEMENT_STATES.UNVERIFIED,
      shellAllowed: false,
      sourceWriteAuthorityGranted: false,
      gitWriteAuthorityGranted: false,
      dependencyMutationAuthorityGranted: false,
      terminationStatus:
        TERMINATION_STATES.NOT_REQUIRED,
      limitations: [],
      evidence: {
        redactionCount:
          redactedError.redactionCount
      }
    });
  }

  if (
    decision.classification !==
    AUTHORIZATION_STATES.APPROVED
  ) {
    return createRejectedResult(decision);
  }

  const profile = decision.profile;
  const normalizedRequest =
    decision.normalizedRequest;

  const executableResolution =
    resolveExecutable(
      profile.executableIdentity
    );

  if (!executableResolution.supported) {
    return freezeResult({
      ...createRejectedResult(decision),
      status: RESULT_STATUSES.RUNTIME_UNAVAILABLE,
      classification:
        AUTHORIZATION_STATES.UNSUPPORTED,
      reason: "executable_identity_unsupported"
    });
  }

  const gitCorrelation =
    validateGitCorrelation(
      normalizedRequest,
      profile
    );

  if (!gitCorrelation.approved) {
    return freezeResult({
      schemaVersion: RESULT_SCHEMA_VERSION,
      requestId:
        normalizedRequest.requestId,
      profileId: profile.profileId,
      status: RESULT_STATUSES.REJECTED,
      classification:
        AUTHORIZATION_STATES.BLOCKED,
      reason: "git_classification_mismatch",
      executed: false,
      startedAt: null,
      completedAt: nowIso(),
      durationMs: 0,
      exitCode: null,
      signal: null,
      timedOut: false,
      outputLimitExceeded: false,
      stdout: "",
      stderr: "",
      stdoutBytes: 0,
      stderrBytes: 0,
      stdoutTruncated: false,
      stderrTruncated: false,
      workingDirectory:
        normalizedRequest.workingDirectory,
      repositoryRoot:
        normalizedRequest.repositoryRoot,
      sandboxRoot:
        normalizedRequest.sandboxRoot,
      executionTarget:
        normalizedRequest.executionTarget,
      networkAllowed: false,
      networkEnforcement:
        NETWORK_ENFORCEMENT_STATES.UNVERIFIED,
      shellAllowed: false,
      sourceWriteAuthorityGranted: false,
      gitWriteAuthorityGranted: false,
      dependencyMutationAuthorityGranted: false,
      terminationStatus:
        TERMINATION_STATES.NOT_REQUIRED,
      limitations: [],
      evidence: {
        requestHash:
          decision.evidence.requestHash,
        gitClassification:
          gitCorrelation.result
      }
    });
  }

  const processArguments = [
    ...profile.fixedArguments,
    ...normalizedRequest.arguments
  ];

  let execution;

  try {
    execution = await spawnControlledProcess({
      executable:
        executableResolution.executable,
      arguments: processArguments,
      profile,
      request: normalizedRequest
    });
  } catch (error) {
    const redactedError = redactText(
      error instanceof Error
        ? error.message
        : String(error)
    );

    return freezeResult({
      schemaVersion: RESULT_SCHEMA_VERSION,
      requestId:
        normalizedRequest.requestId,
      profileId: profile.profileId,
      status: RESULT_STATUSES.INTERNAL_ERROR,
      classification:
        AUTHORIZATION_STATES.UNVERIFIED,
      reason: "runner_internal_error",
      executed: false,
      startedAt: null,
      completedAt: nowIso(),
      durationMs: 0,
      exitCode: null,
      signal: null,
      timedOut: false,
      outputLimitExceeded: false,
      stdout: "",
      stderr: redactedError.value,
      stdoutBytes: 0,
      stderrBytes: Buffer.byteLength(
        redactedError.value,
        "utf8"
      ),
      stdoutTruncated: false,
      stderrTruncated: false,
      workingDirectory:
        normalizedRequest.workingDirectory,
      repositoryRoot:
        normalizedRequest.repositoryRoot,
      sandboxRoot:
        normalizedRequest.sandboxRoot,
      executionTarget:
        normalizedRequest.executionTarget,
      networkAllowed: false,
      networkEnforcement:
        NETWORK_ENFORCEMENT_STATES.UNVERIFIED,
      shellAllowed: false,
      sourceWriteAuthorityGranted: false,
      gitWriteAuthorityGranted: false,
      dependencyMutationAuthorityGranted: false,
      terminationStatus:
        TERMINATION_STATES.NOT_REQUIRED,
      limitations: [],
      evidence: {
        requestHash:
          decision.evidence.requestHash,
        redactionCount:
          redactedError.redactionCount
      }
    });
  }

  return createExecutionResult({
    decision,
    execution,
    executableResolution,
    gitCorrelation
  });
}

export const CONTROLLED_PROCESS_RUNNER_CAPABILITIES =
  Object.freeze({
    schemaVersion: RESULT_SCHEMA_VERSION,
    profilePolicyVersion:
      PROCESS_PROFILE_REGISTRY_CAPABILITIES
        .policyVersion,
    approvedProfileIds:
      PROCESS_PROFILE_REGISTRY_CAPABILITIES
        .approvedProfileIds,
    shellStringsAccepted: false,
    shellEnabled: false,
    arbitraryExecutablesAccepted: false,
    arbitraryArgumentsAccepted: false,
    arbitraryEnvironmentAccepted: false,
    networkAllowedByDefault: false,
    networkIsolationEnforced: false,
    sourceWriteAuthorityGranted: false,
    gitWriteAuthorityGranted: false,
    dependencyMutationAuthorityGranted: false,
    detachedProcessesAllowed: false,
    timeoutEnforced: true,
    outputLimitsEnforced: true,
    stdoutAndStderrSeparated: true,
    secretRedactionEnabled: true,
    gitClassificationRequired: true,
    processTreeTerminationSupport:
      "platform-dependent",
    terminationLimitationsReported: true
  });

export {
  NETWORK_ENFORCEMENT_STATES,
  RESULT_SCHEMA_VERSION,
  RESULT_STATUSES,
  TERMINATION_STATES
};
