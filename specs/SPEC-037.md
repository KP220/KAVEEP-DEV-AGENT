# SPEC-037

## Controlled Process Runner

Version: 0.1

Status: SPECIFIED

Repository: KAVEEP-DEV-AGENT

---

## 1. Purpose

This specification defines the Controlled Process Runner for KAVEEP-DEV-AGENT.

The Controlled Process Runner provides a deterministic and bounded mechanism
for executing explicitly approved engineering commands without granting
general shell access, unrestricted process execution, repository write
authority, network authority, or arbitrary environment control.

The runner exists to support professional engineering validation tasks such as:

- running tests;
- running static analysis;
- running type checking;
- running approved builds;
- inspecting Git repository state;
- validating whitespace and merge-marker conditions;
- executing fixed repository-defined quality gates.

The Controlled Process Runner must not become a general-purpose command shell.

It must execute only commands that are explicitly recognized by policy,
validated before execution, correlated with the current repository and sandbox
context, and bounded by deterministic runtime controls.

---

## 2. Problem Statement

KAVEEP-DEV-AGENT requires the ability to validate code changes.

Validation commonly requires subprocess execution, including commands such as:

```text
npm test
npm run lint
npm run typecheck
npm run build
git status --porcelain
git diff --check
```

A complete prohibition on subprocess execution prevents meaningful engineering
validation.

However, unrestricted subprocess execution creates serious risks, including:

- arbitrary shell command execution;
- command injection;
- process spawning outside the approved boundary;
- repository modification;
- destructive filesystem operations;
- environment-secret exposure;
- network access;
- dependency installation;
- remote code retrieval;
- unbounded CPU or memory consumption;
- unbounded output;
- process-tree escape;
- execution through aliases or shell wrappers;
- platform-specific behavior drift;
- execution against the wrong repository;
- execution after authority or policy drift.

The Controlled Process Runner must provide useful engineering execution while
remaining narrow, deterministic, auditable, bounded, and fail-closed.

---

## 3. Scope

This specification covers:

- process execution request validation;
- executable allowlisting;
- argument allowlisting;
- command-profile classification;
- repository and sandbox boundary enforcement;
- working-directory validation;
- environment-variable filtering;
- shell prohibition;
- network-default denial;
- timeout enforcement;
- output-size limits;
- process-tree termination;
- exit-code and signal capture;
- deterministic result generation;
- Git read-only classifier correlation;
- repository script allowlisting;
- runtime capability reporting;
- audit evidence generation;
- failure and recovery behavior;
- tests required for certification.

This specification does not authorize:

- unrestricted shell execution;
- arbitrary executable execution;
- arbitrary npm scripts;
- package installation;
- remote Git operations;
- source write-back;
- Git write operations;
- container privilege escalation;
- Docker socket access;
- operating-system administration;
- service installation;
- persistent background processes;
- unrestricted network access;
- execution outside the approved repository or sandbox boundary.

---

## 4. Definitions

### 4.1 Controlled Process Runner

A deterministic execution component that runs only approved executable and
argument combinations under bounded runtime controls.

### 4.2 Process Request

A structured object describing a proposed executable invocation.

A Process Request is data, not a shell command string.

### 4.3 Process Profile

A fixed policy definition for an approved command family.

A Process Profile defines:

- executable identity;
- argument schema;
- working-directory policy;
- environment policy;
- timeout limit;
- output limit;
- network policy;
- write-authority policy;
- expected execution purpose.

### 4.4 Executable Allowlist

The explicit set of executable identities that the runner may invoke.

An executable not present in the allowlist must not be executed.

### 4.5 Argument Allowlist

The explicit set or deterministic grammar of accepted arguments for a Process
Profile.

Unknown arguments must fail closed.

### 4.6 Repository Boundary

The canonical filesystem root of the repository approved for the current
engineering session.

### 4.7 Sandbox Boundary

The canonical filesystem root of the isolated sandbox approved for mutation or
validation.

### 4.8 Source Repository

The original repository being inspected or developed.

### 4.9 Read-Only Execution

Execution that does not intentionally modify source files, Git references,
repository configuration, dependency state, operating-system state, or remote
resources.

### 4.10 Write-Capable Execution

Execution that may modify files, Git state, dependencies, caches, build
artifacts, configuration, or external systems.

Write-capable does not imply authorized.

### 4.11 Fixed Command

A command whose executable and accepted argument grammar are defined in code
or trusted policy rather than supplied freely by a model or user prompt.

### 4.12 Shell String

A single command string interpreted by a shell such as:

```text
npm test && git status
```

Shell strings are prohibited.

### 4.13 Process Tree

The started process and any descendant processes created by it.

### 4.14 Fail-Closed

Any ambiguity, mismatch, unknown executable, unknown argument, invalid path,
authority drift, timeout uncertainty, or policy inconsistency results in
non-execution or termination.

---

## 5. Security Principles

### 5.1 No General Shell

The runner must not invoke generic command interpreters such as:

```text
sh
bash
zsh
cmd
cmd.exe
powershell
powershell.exe
pwsh
```

The runner must not use `shell: true` or any equivalent shell-enabled process
execution mechanism.

### 5.2 Structured Invocation Only

The runner must invoke processes using:

- one fixed executable path or trusted executable identity;
- one array of validated arguments;
- one validated working directory;
- one filtered environment object.

### 5.3 Explicit Allowlist

Only explicitly approved Process Profiles may execute.

### 5.4 Unknown Means Blocked

Unknown executable, command profile, argument, option, script, path, or
environment variable must be blocked.

### 5.5 No Implicit Authority

Classification as safe or read-only does not grant:

- source write authority;
- Git write authority;
- network authority;
- dependency installation authority;
- approval bypass.

### 5.6 Least Privilege

Each Process Profile must receive only the minimum capabilities required for
its declared purpose.

### 5.7 Deterministic Classification

The same normalized request and the same policy version must produce the same
authorization decision.

### 5.8 Auditability

Every accepted, rejected, started, completed, timed-out, or terminated process
request must produce auditable structured evidence.

### 5.9 Bounded Execution

Execution must have bounded:

- duration;
- output;
- argument count;
- argument size;
- environment size;
- working-directory scope;
- process-tree lifetime.

### 5.10 No Silent Fallback

The runner must not silently replace an unsupported command with another
command.

---

## 6. Threat Model

The Controlled Process Runner must defend against at least the following
threats.

### 6.1 Shell Injection

Example:

```text
npm test && rm -rf .
```

Mitigation:

- shell strings prohibited;
- arguments passed as an array;
- shell execution disabled.

### 6.2 Argument Injection

Example:

```text
npm run lint -- --fix
```

when `--fix` is not authorized.

Mitigation:

- profile-specific argument grammar;
- unknown arguments blocked.

### 6.3 Script Injection

Example:

```text
npm run arbitrary-user-script
```

Mitigation:

- fixed script-name allowlist;
- arbitrary script names prohibited.

### 6.4 Executable Substitution

Mitigation:

- trusted executable resolution;
- executable identity recording;
- optional absolute-path verification;
- controlled `PATH`.

### 6.5 Working-Directory Escape

Example:

```text
../../another-repository
```

Mitigation:

- canonical path resolution;
- repository or sandbox containment check;
- symbolic-link boundary validation.

### 6.6 Environment Injection

Example:

```text
NODE_OPTIONS=--require malicious.js
GIT_CONFIG_GLOBAL=/tmp/unsafe
```

Mitigation:

- environment allowlist;
- dangerous variables removed;
- user-provided environment overrides rejected.

### 6.7 Git Alias Execution

Mitigation:

- canonical Git subcommands only;
- correlation with SPEC-036 classifier;
- Git alias configuration disabled or ignored.

### 6.8 Git Configuration Override

Example:

```text
git -c alias.status=!malicious status
```

Mitigation:

- global Git override arguments blocked;
- classifier correlation required.

### 6.9 Network Access

Mitigation:

- network-denied policy by default;
- remote-capable commands excluded;
- network-enabled profiles require a separate future specification.

### 6.10 Process Escape

Mitigation:

- detached execution prohibited;
- process-tree termination required;
- completion not reported until termination is confirmed or marked UNVERIFIED.

### 6.11 Output Flooding

Mitigation:

- byte limits;
- truncation markers;
- process termination when the hard output limit is exceeded.

### 6.12 Secret Exposure

Mitigation:

- minimal inherited environment;
- secret-pattern redaction;
- raw secret persistence prohibited.

### 6.13 Repository Modification by Validation Command

Mitigation:

- profile classification;
- sandbox execution for write-capable validation;
- source repository execution limited to approved read-only profiles;
- post-run repository integrity inspection where required.

### 6.14 Dependency Mutation

The following command families are not authorized by this specification:

```text
npm install
npm ci
pnpm install
yarn install
bun install
```

---

## 7. Process Request Contract

A Process Request must be a structured object.

Recommended logical shape:

```json
{
  "schemaVersion": "1.0.0",
  "requestId": "string",
  "profileId": "string",
  "arguments": [],
  "workingDirectory": "string",
  "repositoryRoot": "string",
  "sandboxRoot": "string-or-null",
  "executionTarget": "source-or-sandbox",
  "authoritySnapshotId": "string",
  "policyVersion": "string",
  "correlationId": "string"
}
```

### 7.1 Required Fields

The request must include:

- `schemaVersion`;
- `requestId`;
- `profileId`;
- `arguments`;
- `workingDirectory`;
- `repositoryRoot`;
- `executionTarget`;
- `authoritySnapshotId`;
- `policyVersion`;
- `correlationId`.

### 7.2 Argument Rules

`arguments` must:

- be an array;
- contain only strings;
- contain no null byte;
- contain no carriage return;
- contain no newline;
- remain within bounded argument count;
- remain within bounded per-argument size;
- match the selected Process Profile.

### 7.3 Prohibited Request Fields

A Process Request must not accept:

- raw shell command;
- shell string;
- arbitrary executable path;
- arbitrary environment map;
- arbitrary timeout;
- arbitrary output limit;
- arbitrary network toggle;
- arbitrary write-authority toggle;
- arbitrary detached-process toggle.

These values must come from trusted policy, not request input.

---

## 8. Process Profile Contract

Each Process Profile must be defined in trusted code or trusted policy.

Recommended logical shape:

```json
{
  "profileId": "node.test",
  "executable": "npm",
  "fixedArguments": ["test"],
  "allowedAdditionalArguments": [],
  "executionTarget": "source-or-sandbox",
  "workingDirectoryPolicy": "repository-root",
  "timeoutMs": 120000,
  "maxStdoutBytes": 1048576,
  "maxStderrBytes": 1048576,
  "networkAllowed": false,
  "sourceWriteAllowed": false,
  "gitWriteAllowed": false,
  "dependencyMutationAllowed": false,
  "shellAllowed": false
}
```

### 8.1 Trusted Profile Source

Profiles must come from:

- version-controlled source code;
- validated repository policy;
- an approved signed policy artifact.

Profiles must not be generated freely by the model at runtime.

### 8.2 Required Profile Properties

Every profile must define:

- stable profile ID;
- executable identity;
- fixed or bounded argument grammar;
- execution target;
- working-directory policy;
- timeout;
- stdout limit;
- stderr limit;
- network policy;
- source-write policy;
- Git-write policy;
- dependency-mutation policy;
- shell policy.

### 8.3 Immutable Policy

Profile definitions used for a run must be immutable for the duration of that
run.

---

## 9. Initial Approved Profiles

The first implementation should support only a narrow initial set.

### 9.1 Node Test

Profile ID:

```text
node.test
```

Canonical invocation:

```text
npm test
```

Rules:

- no additional arguments by default;
- no package installation;
- no lifecycle override;
- no shell wrapping;
- timeout bounded;
- network denied by policy;
- source execution allowed only if the script is classified as non-mutating;
- otherwise sandbox execution required.

### 9.2 Node Lint

Profile ID:

```text
node.lint
```

Canonical invocation:

```text
npm run lint
```

Rules:

- `--fix` prohibited unless separately approved in a future write-capable profile;
- arbitrary script names prohibited.

### 9.3 Node Typecheck

Profile ID:

```text
node.typecheck
```

Canonical invocation:

```text
npm run typecheck
```

Rules:

- no extra arguments unless explicitly listed.

### 9.4 Node Build

Profile ID:

```text
node.build
```

Canonical invocation:

```text
npm run build
```

Rules:

- treated as potentially write-capable because build artifacts may be produced;
- source repository execution prohibited unless output isolation is proven;
- sandbox execution preferred;
- no dependency installation.

### 9.5 Git Diff Check

Profile ID:

```text
git.diff-check
```

Canonical invocation:

```text
git diff --check
```

Rules:

- must correlate with SPEC-036;
- must classify as `READ_ONLY`;
- no shell;
- no remote capability;
- no Git write authority.

### 9.6 Git Status Porcelain

Profile ID:

```text
git.status-porcelain
```

Canonical invocation:

```text
git status --porcelain=v2
```

Rules:

- must correlate with SPEC-036;
- must classify as `READ_ONLY`.

### 9.7 Repository Quality Gates

Profile ID:

```text
repository.quality-gates
```

Canonical invocation:

```text
npm test
```

Purpose:

- execute the repository's fixed internal quality-gate entry point.

This profile must not accept an arbitrary replacement script.

---

## 10. Explicitly Blocked Commands

The runner must block at least the following categories unless a future
specification explicitly authorizes them.

### 10.1 Shells

```text
sh
bash
zsh
cmd
cmd.exe
powershell
powershell.exe
pwsh
```

### 10.2 Destructive Filesystem Utilities

```text
rm
rmdir
del
erase
move
mv
copy
cp
robocopy
xcopy
```

### 10.3 Download and Network Utilities

```text
curl
wget
Invoke-WebRequest
ftp
ssh
scp
telnet
nc
```

### 10.4 Dependency Mutation

```text
npm install
npm ci
pnpm install
yarn install
bun install
```

### 10.5 Remote Git Operations

```text
git fetch
git pull
git push
git clone
git remote
git submodule
```

### 10.6 Git Write Operations

All operations classified by SPEC-036 as `WRITE_OPERATION` or `BLOCKED` must
not execute through read-only profiles.

### 10.7 System Administration

```text
sudo
su
runas
systemctl
service
sc
reg
regedit
```

### 10.8 Container Control

```text
docker
podman
kubectl
```

These require separate bounded execution specifications.

---

## 11. Executable Resolution

### 11.1 Trusted Resolution

Executable resolution must use a trusted method.

The runner must not accept an arbitrary executable path from a request.

### 11.2 Identity Evidence

The result should record:

- requested profile ID;
- resolved executable identity;
- resolved executable path when available;
- executable version when deterministically obtainable;
- platform;
- architecture.

### 11.3 PATH Control

The runner should construct a minimal controlled `PATH`.

It must not blindly inherit the full user `PATH` when doing so could allow
executable shadowing.

### 11.4 Platform Correlation

The profile must declare supported platforms.

Unsupported platforms must fail closed.

---

## 12. Working-Directory Enforcement

### 12.1 Canonicalization

The runner must canonicalize:

- repository root;
- sandbox root;
- requested working directory.

### 12.2 Containment

The working directory must be contained within the approved target boundary.

### 12.3 Target Rules

For `executionTarget: source`:

- working directory must remain inside the source repository;
- only read-only or proven non-mutating profiles may run.

For `executionTarget: sandbox`:

- working directory must remain inside the approved sandbox;
- write-capable validation may run only within the profile's declared limits.

### 12.4 Symbolic Links

The runner must reject path resolution that escapes through symbolic links,
junctions, mount points, or equivalent filesystem indirection.

### 12.5 Repository Correlation

The canonical repository root must correlate with the active engineering
session and authority snapshot.

---

## 13. Environment Policy

### 13.1 Minimal Inheritance

Only a minimal allowlist of environment variables may be inherited.

Example candidates:

```text
PATH
HOME
USERPROFILE
TEMP
TMP
TMPDIR
SystemRoot
WINDIR
COMSPEC
PATHEXT
LANG
LC_ALL
TERM
CI
```

The exact allowlist must be platform-aware and version-controlled.

### 13.2 Dangerous Variables

The runner must remove or block variables that may alter execution behavior,
including but not limited to:

```text
NODE_OPTIONS
NODE_PATH
NPM_CONFIG_USERCONFIG
NPM_CONFIG_PREFIX
GIT_CONFIG
GIT_CONFIG_GLOBAL
GIT_CONFIG_SYSTEM
GIT_DIR
GIT_WORK_TREE
GIT_SSH
GIT_SSH_COMMAND
SSH_ASKPASS
GIT_ASKPASS
LD_PRELOAD
DYLD_INSERT_LIBRARIES
PYTHONPATH
RUBYOPT
PERL5OPT
```

### 13.3 Secret Variables

Credential-bearing variables must not be inherited unless a future approved
profile explicitly requires them.

### 13.4 Request Overrides

Process Requests must not supply arbitrary environment overrides.

---

## 14. Network Policy

### 14.1 Default Deny

All initial profiles must declare:

```text
networkAllowed: false
```

### 14.2 Honest Capability Reporting

If the host runtime cannot technically enforce network denial, the result must
report:

```text
networkEnforcement: UNVERIFIED
```

It must not claim that the network was blocked merely because the command was
expected not to use it.

### 14.3 Remote-Capable Commands

Commands known to access remote systems must remain blocked.

### 14.4 Future Network Profiles

Any network-enabled execution requires a separate specification with:

- destination allowlisting;
- protocol restrictions;
- credential policy;
- request approval;
- audit requirements;
- timeout and bandwidth limits.

---

## 15. Source-Write Policy

### 15.1 No Source Write Authority

The runner itself must not grant source write authority.

### 15.2 Read-Only Source Execution

Only profiles proven to be read-only may run against the source repository.

### 15.3 Sandbox Preference

Potentially write-capable commands must run inside the sandbox.

### 15.4 Integrity Correlation

For source-target execution, the runner may require pre-run and post-run
repository inspection.

Any unexpected source change must produce a failed or unsafe result.

### 15.5 No Automatic Cleanup

The runner must not automatically delete or revert unexpected changes unless
separately authorized.

---

## 16. Git Correlation

### 16.1 SPEC-036 Dependency

Every Git profile must call the deterministic Git classifier defined by
SPEC-036 before execution.

### 16.2 Required Classification

Git read-only profiles require:

```text
classification: READ_ONLY
```

### 16.3 Classification Mismatch

Any mismatch between profile expectation and classifier result must block
execution.

### 16.4 No Alias Trust

Git aliases must not be accepted.

### 16.5 No Git Override Mechanisms

Blocked mechanisms include:

```text
-c
--config-env
--exec-path
--git-dir
--work-tree
--namespace
--bare
```

unless a future specification defines a narrower safe use.

---

## 17. Timeout Policy

### 17.1 Fixed Profile Timeout

Timeout must come from the trusted profile.

The request must not choose an arbitrary timeout.

### 17.2 Monotonic Timing

Duration measurement should use a monotonic clock where available.

### 17.3 Timeout Behavior

On timeout, the runner must:

1. mark the process as timed out;
2. stop accepting further output;
3. terminate the process tree;
4. wait for bounded termination confirmation;
5. record termination evidence;
6. return a non-success result.

### 17.4 Unconfirmed Termination

If process-tree termination cannot be confirmed, the result must be:

```text
terminationStatus: UNVERIFIED
```

The runner must not report clean completion.

---

## 18. Output Policy

### 18.1 Separate Streams

The runner must capture stdout and stderr separately.

### 18.2 Byte Limits

Each profile must define:

- maximum stdout bytes;
- maximum stderr bytes.

### 18.3 Truncation

When output exceeds a configured soft limit:

- retained output must be truncated deterministically;
- the result must record original observed byte count where possible;
- a truncation flag must be set.

### 18.4 Hard Output Limit

A profile may define a hard output limit that causes process termination.

### 18.5 Secret Redaction

Captured output must pass through secret redaction before durable persistence.

### 18.6 Binary Output

Unexpected binary output must be rejected, encoded safely, or marked
UNSUPPORTED.

---

## 19. Process-Tree Control

### 19.1 Detached Execution Prohibited

The runner must not intentionally launch detached processes.

### 19.2 Descendant Tracking

The implementation should track or terminate descendants using
platform-appropriate bounded mechanisms.

### 19.3 Windows

On Windows, the implementation may use a bounded process-group or Job Object
strategy where available.

### 19.4 Unix-Like Systems

On Unix-like systems, the implementation may use a dedicated process group and
group termination.

### 19.5 Honest Limitation Reporting

When complete descendant termination cannot be guaranteed, the result must
state that limitation.

---

## 20. Process Result Contract

Recommended logical shape:

```json
{
  "schemaVersion": "1.0.0",
  "requestId": "string",
  "profileId": "string",
  "status": "completed",
  "classification": "APPROVED",
  "executed": true,
  "startedAt": "ISO-8601",
  "completedAt": "ISO-8601",
  "durationMs": 1234,
  "exitCode": 0,
  "signal": null,
  "timedOut": false,
  "outputLimitExceeded": false,
  "stdout": "string",
  "stderr": "string",
  "stdoutBytes": 0,
  "stderrBytes": 0,
  "stdoutTruncated": false,
  "stderrTruncated": false,
  "workingDirectory": "string",
  "repositoryRoot": "string",
  "sandboxRoot": null,
  "executionTarget": "source",
  "networkAllowed": false,
  "networkEnforcement": "UNVERIFIED",
  "shellAllowed": false,
  "sourceWriteAuthorityGranted": false,
  "gitWriteAuthorityGranted": false,
  "dependencyMutationAuthorityGranted": false,
  "terminationStatus": "NOT_REQUIRED",
  "limitations": [],
  "evidence": {}
}
```

### 20.1 Status Values

Suggested status values:

```text
rejected
started
completed
failed
timed_out
terminated
runtime_unavailable
internal_error
```

### 20.2 Executed Flag

Rejected requests must return:

```text
executed: false
```

### 20.3 Success Semantics

A process result is successful only when:

- request validation passed;
- policy authorization passed;
- process started;
- process completed within bounds;
- exit code matched success policy;
- no termination uncertainty exists;
- no unexpected integrity violation occurred.

### 20.4 Evidence

Evidence may include:

- normalized request hash;
- profile version;
- authority snapshot ID;
- policy version;
- executable identity;
- Git classification result;
- pre-run repository state;
- post-run repository state;
- output-redaction count.

---

## 21. Authorization Flow

The runner must follow this sequence:

```text
Receive structured Process Request
        ↓
Validate request schema
        ↓
Resolve trusted Process Profile
        ↓
Verify policy version
        ↓
Verify authority snapshot
        ↓
Canonicalize repository and sandbox roots
        ↓
Validate working-directory containment
        ↓
Validate executable identity
        ↓
Validate fixed and bounded arguments
        ↓
Correlate Git request with SPEC-036 when applicable
        ↓
Verify execution-target policy
        ↓
Construct minimal environment
        ↓
Record authorization decision
        ↓
Spawn without shell
        ↓
Capture bounded output
        ↓
Enforce timeout and process-tree control
        ↓
Inspect integrity when required
        ↓
Redact durable output
        ↓
Return structured Process Result
```

Any failed step must prevent execution or force bounded termination.

---

## 22. Classification States

The authorization layer should use explicit states.

### 22.1 APPROVED

The request exactly matches an approved profile and all required checks pass.

### 22.2 REJECTED

The request is known but not authorized.

### 22.3 BLOCKED

The request contains an unsafe or prohibited mechanism.

### 22.4 UNSUPPORTED

The runtime or platform cannot perform the requested profile.

### 22.5 UNVERIFIED

A required safety property cannot be verified.

`UNVERIFIED` must never be silently treated as `APPROVED`.

---

## 23. Failure Handling

### 23.1 Validation Failure

Malformed request:

```text
status: rejected
executed: false
```

### 23.2 Unknown Profile

Unknown profile:

```text
status: rejected
executed: false
```

### 23.3 Policy Drift

If the profile version or policy version changes after request creation:

```text
status: rejected
reason: policy_drift
```

### 23.4 Authority Drift

If the authority snapshot is invalid, expired, or mismatched:

```text
status: rejected
reason: authority_drift
```

### 23.5 Runtime Unavailable

If the executable is not available:

```text
status: runtime_unavailable
executed: false
```

### 23.6 Spawn Failure

If the executable cannot start:

```text
status: failed
executed: false
```

### 23.7 Nonzero Exit

A nonzero exit code must be recorded as a failed process result unless the
profile explicitly defines another accepted code.

### 23.8 Internal Error

Internal runner errors must fail closed and must not leak secrets.

---

## 24. Audit Requirements

Each attempt must record:

- request ID;
- correlation ID;
- profile ID;
- normalized request hash;
- authorization decision;
- rejection or block reason;
- policy version;
- authority snapshot ID;
- repository root identifier;
- sandbox root identifier when applicable;
- start and end timestamps;
- duration;
- exit code;
- signal;
- timeout state;
- output truncation state;
- network policy;
- source-write authority state;
- Git-write authority state;
- dependency-mutation authority state;
- termination status;
- limitations;
- redaction count.

Raw secrets must never appear in audit records.

---

## 25. Initial Runtime Limits

Recommended initial limits:

```text
Maximum arguments per request: 32
Maximum bytes per argument: 512
Maximum environment variables: 32
Maximum environment value length: 4096 bytes
Default timeout: 120000 ms
Maximum initial timeout: 600000 ms
Maximum stdout: 1048576 bytes
Maximum stderr: 1048576 bytes
Maximum combined retained output: 2097152 bytes
Detached process: prohibited
Network: denied by policy
Shell: prohibited
```

These values may be tightened by individual profiles.

---

## 26. Determinism Requirements

The pre-execution decision must depend only on:

- normalized Process Request;
- immutable Process Profile;
- policy version;
- authority snapshot;
- canonical repository and sandbox boundaries;
- deterministic Git classification when applicable;
- platform capability snapshot.

The runner must not base authorization on:

- free-form model reasoning;
- user shell aliases;
- ambient Git aliases;
- unvalidated repository text;
- untrusted environment variables;
- mutable hidden state.

---

## 27. Capability Reporting

The implementation must expose a capability object.

Recommended logical shape:

```json
{
  "schemaVersion": "1.0.0",
  "runner": "controlled",
  "shellStringsAccepted": false,
  "arbitraryExecutablesAccepted": false,
  "arbitraryArgumentsAccepted": false,
  "arbitraryEnvironmentAccepted": false,
  "networkAllowedByDefault": false,
  "sourceWriteAuthorityGranted": false,
  "gitWriteAuthorityGranted": false,
  "dependencyMutationAuthorityGranted": false,
  "detachedProcessesAllowed": false,
  "timeoutEnforced": true,
  "outputLimitsEnforced": true,
  "processTreeTerminationSupported": "platform-dependent",
  "approvedProfiles": []
}
```

Capability reporting must distinguish:

- implemented;
- unsupported;
- planned;
- unverified.

---

## 28. Required Implementation Modules

The first implementation should add modules equivalent to:

```text
src/process/controlled-process-runner.mjs
src/process/process-profile-registry.mjs
src/process/process-request-validator.mjs
tools/test-controlled-process-runner.mjs
```

The exact filenames may vary, but responsibilities must remain separated.

### 28.1 Runner

Responsible for bounded process lifecycle.

### 28.2 Profile Registry

Responsible for immutable trusted profiles.

### 28.3 Request Validator

Responsible for deterministic request validation and normalization.

### 28.4 Tests

Responsible for positive, negative, timeout, output, path, and injection
regressions.

---

## 29. Required Tests

The implementation must include at least the following tests.

### 29.1 Approved Profile Tests

Verify approved execution for:

- fixed Node test profile;
- fixed Git diff-check profile;
- fixed Git status profile.

### 29.2 Unknown Profile Test

Unknown profile must not execute.

### 29.3 Shell Injection Test

A shell string or shell metacharacter attempt must be blocked.

### 29.4 Argument Injection Test

Unknown extra arguments must be blocked.

### 29.5 Arbitrary Script Test

Arbitrary npm script names must be blocked.

### 29.6 Executable Override Test

A request attempting to provide a custom executable must be blocked.

### 29.7 Working-Directory Escape Test

A path outside the repository or sandbox must be blocked.

### 29.8 Symbolic-Link Escape Test

A symbolic-link escape must be blocked where the platform supports the test.

### 29.9 Environment Injection Test

Dangerous environment variables must not be inherited or accepted.

### 29.10 Git Correlation Test

A Git request not classified as `READ_ONLY` by SPEC-036 must not execute.

### 29.11 Timeout Test

A long-running process must be terminated within the bounded timeout window.

### 29.12 Output Limit Test

Excessive stdout and stderr must be truncated or terminated according to
profile policy.

### 29.13 Nonzero Exit Test

Nonzero exit code must produce a failed result with captured evidence.

### 29.14 Runtime Unavailable Test

Missing executable must produce `runtime_unavailable`.

### 29.15 Determinism Test

The same normalized request and policy must produce the same authorization
decision.

### 29.16 Immutable Result Test

Capability and result objects should be immutable where practical.

### 29.17 No-Execution-on-Rejection Test

Rejected or blocked requests must not spawn a process.

### 29.18 Secret Redaction Test

Sensitive token-like output must be redacted before persistence.

### 29.19 Source Integrity Test

An approved source-target read-only profile must not leave repository changes.

### 29.20 Process-Tree Termination Test

Descendant processes must not survive timeout where platform enforcement is
supported.

---

## 30. Quality-Gate Integration

The Controlled Process Runner tests must be added to:

```text
tools/run-quality-gates.mjs
```

Suggested gate name:

```text
Controlled Process Runner
```

The quality-gate count must increase accordingly.

The repository must not claim the runner is verified until the complete
quality-gate suite passes.

---

## 31. Acceptance Criteria

SPEC-037 is accepted only when all of the following are true.

### 31.1 Request Safety

- structured requests only;
- no shell strings;
- no arbitrary executable;
- no arbitrary environment;
- no arbitrary timeout or output limit.

### 31.2 Profile Safety

- profiles are explicit and immutable;
- unknown profiles fail closed;
- unknown arguments fail closed;
- arbitrary npm scripts are blocked.

### 31.3 Boundary Safety

- working directory is canonicalized;
- repository or sandbox containment is enforced;
- path escapes are blocked.

### 31.4 Execution Safety

- shell execution disabled;
- detached execution disabled;
- timeout enforced;
- output limits enforced;
- process-tree termination attempted and reported honestly.

### 31.5 Authority Safety

- no source-write authority granted;
- no Git-write authority granted;
- no dependency-mutation authority granted;
- network denied by policy.

### 31.6 Git Safety

- Git profiles correlate with SPEC-036;
- only `READ_ONLY` Git requests execute;
- aliases and overrides remain blocked.

### 31.7 Audit Safety

- decisions and results are structured;
- secrets are redacted;
- limitations are explicit;
- `UNVERIFIED` is never presented as verified.

### 31.8 Regression Safety

- all new runner tests pass;
- all existing repository quality gates remain passing.

---

## 32. Non-Goals

SPEC-037 does not attempt to provide:

- a terminal emulator;
- a remote shell;
- unrestricted command execution;
- general build-system discovery;
- automatic package installation;
- remote repository synchronization;
- production deployment;
- container orchestration;
- operating-system administration;
- unattended long-running background agents;
- network-enabled tool execution;
- autonomous approval.

---

## 33. Future Extensions

Potential future specifications may define:

- approved network-capable process profiles;
- container-backed process execution;
- signed executable identity verification;
- Windows Job Object enforcement;
- Linux namespace enforcement;
- cgroup resource limits;
- CPU and memory quotas;
- build-output isolation;
- language-specific execution profiles;
- trusted compiler toolchains;
- signed process evidence;
- remote worker execution;
- KCP-reviewed execution policy.

These extensions must not weaken the baseline controls defined here.

---

## 34. Security Invariants

The following invariants must always remain true.

```text
No shell string becomes a process invocation.
No unknown profile executes.
No unknown argument executes.
No arbitrary executable executes.
No request grants itself more authority.
No rejected request spawns a process.
No Git write operation passes as read-only.
No path outside the approved boundary becomes the working directory.
No timeout result is reported as clean success.
No unconfirmed process termination is reported as verified.
No secret is intentionally persisted in raw output.
No network authority is implied by local execution.
No source-write authority is implied by validation.
```

---

## 35. Implementation Order

Recommended implementation sequence:

```text
1. Define immutable process profiles
2. Define request normalization and validation
3. Implement deterministic authorization decision
4. Add repository and sandbox path-boundary validation
5. Correlate Git profiles with SPEC-036
6. Implement minimal environment construction
7. Implement shell-free process spawning
8. Add bounded stdout and stderr capture
9. Add timeout enforcement
10. Add process-tree termination
11. Add structured result generation
12. Add secret redaction
13. Add regression tests
14. Add the new quality gate
15. Run all repository quality gates
16. Review evidence before merge
```

---

## 36. Review Decision Rule

Reviewers should approve only when evidence demonstrates that:

- the runner is not a general-purpose shell;
- execution is driven by trusted fixed profiles;
- all boundaries are enforced;
- all authority remains explicit;
- rejected requests never execute;
- Git classification correlation is deterministic;
- timeout and output limits are effective;
- process termination limitations are reported honestly;
- all quality gates pass.

If evidence is insufficient, the state must be:

```text
UNVERIFIED
```

Absence of evidence must never be treated as proof of safety.

---

## 37. Final Statement

The Controlled Process Runner is the execution boundary between
KAVEEP-DEV-AGENT reasoning and the host operating system.

It must remain narrow, explicit, deterministic, bounded, auditable, and
fail-closed.

The runner may execute approved engineering validation.

It must not become unrestricted command authority.
