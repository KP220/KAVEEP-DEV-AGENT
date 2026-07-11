# SPEC-015

## Iterative Engineering Loop

Owner: KAVEEP-DEV-AGENT

### Purpose

SPEC-015 connects Engineering Brain, Sandbox File Editor, and Sandbox Static Validation into the first bounded coding loop. The loop proposes edits, applies them only inside one verified sandbox, parses explicit JavaScript targets, returns normalized failure evidence to the Brain, and permits a bounded revision attempt.

### Loop

```text
verified sandbox
  -> Engineering Brain proposal
  -> deterministic proposal checks
  -> sandbox-only file edits
  -> Node.js static syntax validation
  -> passed: reviewable result
  -> failed: bounded feedback and revised proposal
```

### Boundaries

The caller supplies an active Brain Request, registered provider adapter, exact sandbox manifest, and maximum attempts. Each attempt receives a unique Brain Request ID. Validation feedback is data, not authority. Context file hashes are refreshed from the sandbox before revision.

The loop does not run tests, builds, npm, dependencies, shell commands, network tools, Git, source write-back, release, or deployment. It never treats a successful parse as approval. Attempts are sequential and bounded from one to five. Exhaustion stops with reviewable failure evidence.

### Acceptance criteria

- Loop Request and Result contracts validate.
- A valid first proposal may complete in one attempt.
- Invalid syntax is returned to Brain and may be corrected in a later bounded attempt.
- Provider failure, proposal rejection, edit failure, validation failure, and attempt exhaustion stop safely.
- Every attempt preserves Brain, edit, and validation evidence.
- Source repository content remains unchanged.
- Existing quality gates continue to pass.

