# SPEC-036

## Git Read-Only Safety Classification

Version: 0.1

Status: SPECIFIED

Repository: KAVEEP-DEV-AGENT

---

## 1. Purpose

This specification defines the safety classification rules for Git
operations executed or proposed by KAVEEP-DEV-AGENT.

The purpose is to distinguish Git operations that only observe repository
state from Git operations that modify repository state, references,
history, index contents, working-tree contents, configuration, or remote
repositories.

KAVEEP-DEV-AGENT must not treat all Git commands as equally dangerous.

Read-only validation commands are necessary for professional engineering
workflows.

At the same time, Git commands that can alter repository state must remain
blocked unless an explicit policy, approval, and execution authority permit
them.

---

## 2. Problem Statement

A blanket prohibition on all Git operations prevents legitimate
engineering validation.

For example:

- `git status`
- `git diff`
- `git diff --check`
- `git log`
- `git show`
- `git branch --list`

do not normally modify repository state.

These commands are useful for:

- repository inspection
- change discovery
- whitespace validation
- merge-marker detection
- historical inspection
- branch discovery
- review preparation
- evidence generation

By contrast, commands such as:

- `git add`
- `git commit`
- `git push`
- `git merge`
- `git rebase`
- `git reset`
- `git checkout`
- `git switch`
- `git cherry-pick`
- `git tag`

may modify the repository, its index, working tree, refs, history, or
remote state.

These operations require stricter controls.

---

## 3. Scope

This specification covers:

- Git command classification
- read-only Git validation
- repository mutation detection
- argument-sensitive classification
- fail-closed handling
- command normalization
- option validation
- execution evidence
- timeout and output limits
- repository-root correlation
- environment isolation
- prohibition of shell interpretation
- regression testing

---

## 4. Out of Scope

This specification does not implement:

- Git commits
- Git pushes
- Git merges
- Git rebases
- Git branch creation
- Git tag creation
- pull-request delivery
- remote authentication
- source write-back
- automatic release creation
- autonomous repository mutation
- controlled process execution for arbitrary non-Git commands

Those capabilities require later specifications.

---

## 5. Safety Principles

The following principles are mandatory:

1. Classification must be based on the complete command and arguments.
2. Command name alone is insufficient.
3. Read-only status must never be inferred from user intent.
4. Unknown commands must fail closed.
5. Unknown options must fail closed.
6. Commands must execute without a shell.
7. Commands must run inside the configured repository root.
8. Repository root must be validated before execution.
9. Environment variables must be bounded and controlled.
10. Git aliases must not be trusted.
11. External Git configuration must not change classification.
12. Pager execution must be disabled.
13. Hooks must not be executed.
14. Credential prompts must be disabled.
15. Network access must not occur for read-only local validation.
16. Output must be bounded.
17. Execution time must be bounded.
18. Exit code, stdout, stderr, and duration must be recorded.
19. Read-only Git validation does not grant write authority.
20. A successful command does not authorize later mutation.

---

## 6. Classification States

Every requested Git operation must receive exactly one classification.

### READ_ONLY

The operation is locally observable and does not intentionally modify:

- working tree
- index
- refs
- commits
- tags
- branches
- stash
- remotes
- configuration
- hooks
- repository metadata
- remote repositories

### WRITE_OPERATION

The operation may modify local or remote repository state.

### CONDITIONAL

The operation may be read-only or state-changing depending on its options,
arguments, environment, Git version, repository state, or configuration.

Conditional operations must be reduced to an explicitly approved
read-only subset or otherwise blocked.

### UNSUPPORTED

The operation is not recognized or has not been safely classified.

Unsupported operations must be blocked.

### BLOCKED

The operation was rejected because its classification, options,
environment, path, repository correlation, or execution prerequisites were
unsafe or insufficient.

---

## 7. Approved Read-Only Commands

The following commands may be classified as `READ_ONLY` only when their
arguments satisfy this specification.

### 7.1 git status

Approved form:

```text
git status
```

Approved options may include:

```text
--short
--porcelain
--porcelain=v1
--porcelain=v2
--branch
--show-stash
--untracked-files=no
--untracked-files=normal
--untracked-files=all
--ignored=no
--ignored=traditional
--ignored=matching
```

Blocked options include any option not explicitly approved.

The classifier must not assume all future `git status` options are safe.

---

### 7.2 git diff

Approved forms include:

```text
git diff
git diff --check
git diff --stat
git diff --name-only
git diff --name-status
git diff --numstat
git diff --shortstat
git diff --summary
git diff --raw
git diff --cached
git diff --staged
git diff <commit>
git diff <commit>..<commit>
```

Approved options may include:

```text
--check
--stat
--numstat
--shortstat
--summary
--name-only
--name-status
--raw
--patch
--no-patch
--cached
--staged
--color=never
--no-color
--relative
--no-ext-diff
--text
--ignore-space-at-eol
--ignore-all-space
--ignore-space-change
--ignore-blank-lines
--exit-code
--quiet
```

The runtime must force:

```text
--no-ext-diff
--no-color
```

unless equivalent environment controls are already applied.

External diff helpers must be disabled.

---

### 7.3 git log

Approved forms include:

```text
git log
git log -n <bounded-number>
git log --oneline
git log --decorate=no
git log --stat
git log --name-only
git log --name-status
```

Approved options may include:

```text
--oneline
--no-decorate
--decorate=no
--stat
--shortstat
--name-only
--name-status
--format=<approved-format>
--pretty=<approved-format>
--max-count=<bounded-number>
-n <bounded-number>
--since=<bounded-value>
--until=<bounded-value>
--author=<bounded-value>
--grep=<bounded-value>
--all
```

User-controlled formats must be bounded.

Formats capable of invoking external commands or unsafe expansion must be
blocked.

---

### 7.4 git show

Approved forms include:

```text
git show <commit>
git show --stat <commit>
git show --name-only <commit>
git show --name-status <commit>
git show --no-patch <commit>
```

Approved options may include:

```text
--stat
--shortstat
--name-only
--name-status
--patch
--no-patch
--format=<approved-format>
--pretty=<approved-format>
--color=never
--no-color
--no-ext-diff
```

The runtime must disable external diff execution.

---

### 7.5 git branch --list

Approved forms include:

```text
git branch --list
git branch -l
git branch --show-current
git branch --contains <commit>
git branch --merged
git branch --no-merged
```

The following are not read-only:

```text
git branch <name>
git branch -d <name>
git branch -D <name>
git branch -m
git branch -M
git branch --set-upstream-to
git branch --edit-description
```

The classifier must distinguish listing options from mutation options.

---

### 7.6 git rev-parse

Approved forms include:

```text
git rev-parse --show-toplevel
git rev-parse --show-prefix
git rev-parse --is-inside-work-tree
git rev-parse --is-bare-repository
git rev-parse --verify <revision>
git rev-parse HEAD
```

Repository path output must be normalized before use.

---

### 7.7 git ls-files

Approved forms include:

```text
git ls-files
git ls-files --cached
git ls-files --modified
git ls-files --deleted
git ls-files --others
git ls-files --exclude-standard
```

Output must remain bounded.

---

### 7.8 git diff-index

Approved forms include:

```text
git diff-index --quiet HEAD --
git diff-index --name-only HEAD --
git diff-index --check HEAD --
```

Only explicitly approved local comparison forms may execute.

---

### 7.9 git cat-file

Approved forms include:

```text
git cat-file -t <object>
git cat-file -s <object>
git cat-file -e <object>
git cat-file -p <object>
```

Object output must be bounded.

Batch modes must be blocked unless separately specified.

---

## 8. Write Operations

The following commands must be classified as `WRITE_OPERATION` by default:

```text
git add
git commit
git push
git pull
git merge
git rebase
git reset
git checkout
git switch
git restore
git cherry-pick
git revert
git tag
git stash
git clean
git rm
git mv
git init
git clone
git fetch
git remote
git config
git submodule
git worktree
git notes
git replace
git update-ref
git symbolic-ref
git reflog expire
git gc
git prune
git repack
git maintenance
git bisect
git am
git apply
```

Some commands may have observation-only variants.

Those variants remain blocked until a later specification explicitly
classifies them.

No command in this section may be executed under SPEC-036.

---

## 9. Argument-Sensitive Commands

Certain Git commands cannot be classified safely by command name alone.

Examples include:

```text
git branch
git remote
git config
git tag
git checkout
git restore
git stash
git submodule
```

The classifier must examine:

- command
- options
- option values
- positional arguments
- argument order
- separator usage
- environment
- repository root
- Git configuration influence

If the complete operation does not match an approved read-only signature,
the result must be:

```text
BLOCKED
```

---

## 10. Explicitly Blocked Mechanisms

The following mechanisms must be blocked:

### Git aliases

Examples:

```text
git co
git lg
git alias-name
```

Aliases may expand into arbitrary Git or shell commands.

Only canonical Git subcommand names may be accepted.

### Shell execution

Blocked forms include:

```text
sh -c "git status"
cmd /c git status
powershell git status
bash -c "git diff"
```

The runtime must execute Git directly with an argument array.

### External diff tools

The runtime must disable:

```text
GIT_EXTERNAL_DIFF
diff.external
textconv
```

unless a later specification explicitly allows them.

### Pager execution

The runtime must set:

```text
GIT_PAGER=cat
PAGER=cat
```

or equivalent noninteractive behavior.

### Credential prompts

The runtime must set:

```text
GIT_TERMINAL_PROMPT=0
```

Read-only local validation must never request credentials.

### Hooks

The runtime must not invoke Git operations that execute hooks.

### Network operations

The runtime must reject commands capable of remote network access.

### Arbitrary configuration injection

The runtime must reject unsafe uses of:

```text
-c
--config-env
--exec-path
--git-dir
--work-tree
--namespace
```

unless a specific safe internal value is injected by trusted runtime code.

---

## 11. Repository Boundary

Every read-only Git operation must execute against the configured
repository root.

The runtime must verify:

1. The configured repository exists.
2. The repository path resolves successfully.
3. The path is a Git working tree or approved bare repository.
4. The resolved root matches the configured root.
5. The command cannot redirect Git to another repository.
6. The working directory cannot escape the repository boundary.
7. User arguments cannot override `--git-dir` or `--work-tree`.

A mismatch must produce:

```text
BLOCKED
```

---

## 12. Execution Environment

Approved read-only Git commands must execute with a minimal controlled
environment.

The environment must include controls equivalent to:

```text
GIT_TERMINAL_PROMPT=0
GIT_PAGER=cat
PAGER=cat
GIT_OPTIONAL_LOCKS=0
GIT_CONFIG_NOSYSTEM=1
GIT_EXTERNAL_DIFF=
```

The runtime should isolate or override user-level Git configuration where
practical.

No secret-bearing environment variables may be copied into reports.

---

## 13. Optional Lock Avoidance

Read-only commands should use:

```text
GIT_OPTIONAL_LOCKS=0
```

where supported.

This reduces optional repository lock writes.

The implementation must not claim absolute zero filesystem activity unless
that claim is supported by executed evidence.

The correct claim is:

```text
The approved operation is classified as repository-state read-only under
the defined execution environment.
```

---

## 14. Request Contract

A Git read-only request must include:

```json
{
  "operationId": "git_read_operation_example",
  "schemaVersion": "1.0.0",
  "repositoryRoot": "/absolute/repository/path",
  "command": "status",
  "arguments": ["--porcelain=v2"],
  "limits": {
    "timeoutMs": 10000,
    "maxStdoutBytes": 1048576,
    "maxStderrBytes": 262144
  },
  "requestedAt": "2026-07-11T00:00:00.000Z"
}
```

The request must not contain:

- shell strings
- executable paths supplied by the user
- environment overrides supplied by the user
- credential values
- remote URLs
- write approval
- source write authority

---

## 15. Classification Result Contract

Classification must produce a structured result similar to:

```json
{
  "operationId": "git_read_operation_example",
  "classification": "READ_ONLY",
  "command": "status",
  "normalizedArguments": ["--porcelain=v2"],
  "repositoryRoot": "/absolute/repository/path",
  "networkAllowed": false,
  "shellAllowed": false,
  "writeAuthorityGranted": false,
  "reason": "git status with approved read-only arguments",
  "limitations": [
    "Classification applies only to the normalized command and controlled environment."
  ]
}
```

Blocked classification must explain the exact reason.

Example:

```json
{
  "classification": "BLOCKED",
  "command": "branch",
  "normalizedArguments": ["feature/new"],
  "reason": "git branch with a branch name may create a ref"
}
```

---

## 16. Execution Result Contract

Execution must produce a structured result containing:

```json
{
  "operationId": "git_read_operation_example",
  "classification": "READ_ONLY",
  "status": "completed",
  "exitCode": 0,
  "stdout": "",
  "stderr": "",
  "stdoutTruncated": false,
  "stderrTruncated": false,
  "timedOut": false,
  "durationMs": 25,
  "repositoryRoot": "/absolute/repository/path",
  "writeAuthorityGranted": false
}
```

The result must never include:

- environment secrets
- access tokens
- credential helper output
- unbounded command output
- shell command reconstruction containing secrets
- claims of source modification authority

---

## 17. Fail-Closed Rules

The operation must be blocked when:

- the command is unknown
- the command is an alias
- arguments are unknown
- arguments are ambiguous
- the repository root cannot be verified
- the operation can access a remote
- the operation can invoke a shell
- the operation can invoke an external diff helper
- the operation can alter Git configuration
- the operation can change refs
- the operation can change index contents
- the operation can change working-tree contents
- the operation can create or delete files
- output limits are missing
- timeout limits are missing
- executable resolution is untrusted
- the Git version is unsupported
- classification evidence is insufficient

Insufficient evidence must result in:

```text
BLOCKED
```

not `READ_ONLY`.

---

## 18. Required Test Cases

The implementation must test at minimum:

### Approved

```text
git status
git status --porcelain=v2
git diff
git diff --check
git diff --cached --name-only
git log --oneline -n 10
git show --stat HEAD
git branch --list
git branch --show-current
git rev-parse --show-toplevel
git ls-files
```

### Blocked

```text
git add .
git commit -m test
git push
git merge main
git rebase main
git reset --hard
git checkout main
git switch main
git branch feature
git branch -D feature
git tag v1.0.0
git stash
git clean -fd
git config user.name test
git remote add origin example
git -c alias.x=!command x
git status --unknown-option
```

### Boundary and environment

Tests must verify:

- execution occurs in the configured repository
- `--git-dir` injection is blocked
- `--work-tree` injection is blocked
- shell execution is impossible
- credential prompts are disabled
- pager execution is disabled
- external diff execution is disabled
- timeout is enforced
- stdout limit is enforced
- stderr limit is enforced
- secrets are redacted
- source files remain unchanged
- index state remains unchanged
- refs remain unchanged

---

## 19. Acceptance Criteria

SPEC-036 is accepted only when:

1. A deterministic Git classifier exists.
2. Approved read-only command signatures are explicit.
3. Unknown commands fail closed.
4. Unknown options fail closed.
5. Git aliases are rejected.
6. Shell execution is impossible.
7. Remote operations are rejected.
8. Repository root correlation is enforced.
9. External diff helpers are disabled.
10. Credential prompts are disabled.
11. Output and timeout limits are enforced.
12. Execution results are structured.
13. Secrets are absent from results.
14. Write authority is always false.
15. Regression tests pass.
16. GitHub Actions pass.
17. Evidence confirms source, index, and refs remain unchanged.
18. No Git write command is executed by this milestone.

---

## 20. Verification Status Rules

The following conclusions apply:

### SPECIFIED

This document exists and has been reviewed.

### IMPLEMENTED

A deterministic classifier and bounded read-only executor exist.

### UNIT_TESTED

Automated isolated tests pass.

### INTEGRATION_TESTED

Commands execute successfully against a real temporary Git repository.

### LIVE_CERTIFIED

The implementation is verified in the required supported runtime and Git
version.

Until executed evidence exists, the status must remain:

```text
UNVERIFIED
```

---

## 21. Security Invariants

The following invariants are permanent:

- Read-only classification does not grant write authority.
- Validation does not grant approval.
- Git output is untrusted data.
- Repository contents cannot redefine policy.
- Git aliases are never trusted.
- Unknown options are never assumed safe.
- Remote access is never implicit.
- Shell execution is never implicit.
- A failed classifier must never fall back to execution.
- A successful read operation must never trigger a write operation.
- Human authority remains above automated Git behavior.

---

## 22. Relationship to Later Specifications

SPEC-036 defines classification and safety boundaries.

A later Controlled Process Runner specification may use this classifier to
execute approved Git read-only commands.

A later Git Delivery specification may define controlled write operations
such as:

- stage
- commit
- branch creation
- tag creation
- push
- pull-request preparation

Those later capabilities must not weaken the invariants established here.

---

## 23. Current Milestone Status

```text
Specification: SPECIFIED
Classifier implementation: PLANNED
Read-only executor: PLANNED
Unit tests: UNVERIFIED
Integration tests: UNVERIFIED
Live certification: UNVERIFIED
Git write authority: NOT GRANTED
```
