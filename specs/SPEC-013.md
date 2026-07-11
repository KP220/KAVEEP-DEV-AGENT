# SPEC-013

## Sandbox Static Validation Runner

Owner: KAVEEP-DEV-AGENT

### Purpose

SPEC-013 introduces the first bounded process capability: Node.js syntax validation of explicit JavaScript files inside a verified Secure Sandbox. It invokes the current trusted Node executable with `--check` and never executes repository modules.

### Scope

The only supported operation is `node_syntax_check` for explicit sandbox-relative `.js`, `.mjs`, and `.cjs` regular files. Targets, ancestors, and the sandbox must pass canonical containment and no-link verification. Internal sandbox metadata is denied.

Each request bounds file count, per-file timeout, and captured output bytes. The runner uses a minimal environment, fixed executable, fixed flag structure, hidden windows, no shell, no package manager, no PATH discovery, and no caller-provided arguments or environment variables.

### Security boundary

`node --check` parses the target without running it. SPEC-013 does not claim safe execution of tests, builds, lifecycle scripts, dependencies, or arbitrary repository code. Full Build/Test Runner requires OS or container isolation that controls filesystem, child processes, network, CPU, memory, and process trees.

### Acceptance criteria

- request and result contracts validate;
- valid syntax succeeds and invalid syntax returns normalized failure;
- traversal, absolute paths, links, internal metadata, unsupported extensions, excessive files, timeout, and output overflow fail closed;
- no shell, npm, package script, repository import, source write, network, Git, or deployment occurs;
- source integrity remains unchanged.

