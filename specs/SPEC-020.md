# SPEC-020

## Container Build and Test Runner

SPEC-020 runs explicit Node.js validation operations inside a verified Secure Sandbox mounted into a hardened Docker container. Supported operations are `lint`, `typecheck`, `test`, and `build`; raw commands and dependency installation are unavailable.

The image must be explicitly allowlisted. Containers use no network, no capabilities, no-new-privileges, a non-root user, read-only root filesystem, bounded memory/CPU/PIDs, tmpfs temporary storage, fixed workspace mount, timeout, output limit, CID-file cleanup, and no Docker socket or host secrets.

Package scripts are discovered from sandbox `package.json`; only the exact semantic operation is translated to `npm run --ignore-scripts <name>`. Missing scripts are skipped, not invented. Results distinguish passed, failed, timed out, blocked, and runtime unavailable.

Docker availability is an environmental precondition. Unit/security tests must run with a mock process adapter; live isolation tests must report an explicit skip when the daemon is unavailable.
