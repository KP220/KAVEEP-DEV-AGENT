# SPEC-009

## Sandbox File Editor

### Purpose and scope

Sandbox File Editor is the first write-capable KAVEEP-DEV-AGENT component. It performs explicit deterministic file edits only inside a marker-verified Secure Sandbox created by SPEC-008. It never writes to the source repository and does not provide autonomous engineering.

### Supported operations

The editor supports create, overwrite, append, exact text replace, rename, and delete for regular sandbox files. Inputs are sandbox-relative paths. Operations execute in caller order and return normalized, ordered change evidence.

### Unsupported operations and boundaries

Source paths, absolute paths, traversal, sandbox metadata, directories as edit targets, symbolic links, link traversal, unverified or expired/cleaned sandboxes, Git, shell/process execution, network access, build/test execution, deployment, dependency installation, source write-back, and autonomous operation are unsupported. Tool Orchestrator does not automatically invoke the editor; the CLI requires an exact manifest and explicit operations file.

### Identity and containment

The editor reuses `verifySecureSandbox` from Secure Sandbox Manager. Verification requires the canonical manifest location, OS temporary-root containment, manager directory prefix, ready status, valid sandbox identity, distinct source identity, and matching unpredictable marker. Each target is normalized, resolved inside the canonical root, and checked component-by-component without following links.

### Rollback philosophy and change tracking

Every successful edit records its operation, original and resulting relative paths, SHA-256 before/after hashes, before/after byte counts, timestamp, and evidence reference. The inverse operation and required pre-edit content are recorded in a rollback instruction. `rollbackReady: true` means sufficient deterministic evidence is present for a future controlled rollback executor; SPEC-009 records but does not autonomously execute rollback.

### Diff generation and engineering evidence

Diff generation reuses SPEC-008 Change Detection and never invokes Git. The summary sorts added, modified, and deleted paths and records aggregate byte delta, warnings, and limitations. Per-operation verified evidence and the complete edit result are persisted beneath the internal `.kaveep-changes` directory, which change detection excludes as manager metadata.

### Future Build/Test and Git integration

A future Build/Test Runner may consume validated sandbox state but requires its own execution, resource, and policy milestone. A future Git Runtime may consume reviewed change evidence but must not infer source write-back authority from this editor. Neither capability is implemented here.

### Acceptance criteria

- canonical Change Set, Diff Summary, and Edit Result schemas and examples validate;
- all six operations work only in a verified SPEC-008 sandbox;
- traversal, absolute/outside paths, internal metadata, links, and invalid sandboxes are rejected;
- each edit emits hashes, byte counts, timestamp, evidence, and rollback instruction;
- deterministic diff reports added, modified, deleted, bytes changed, warnings, and limitations without Git;
- focused tests prove source integrity and existing suites continue to pass;
- no shell, process, network, Git, build/test runner, deployment, or source write-back is introduced.
