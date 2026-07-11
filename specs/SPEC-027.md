# SPEC-027

## Multi-language Execution Profiles and Live Isolation Certification

SPEC-027 supports fixed semantic command profiles for Node/TypeScript, Python, Go, and Rust. Requests select a profile and an explicitly allowlisted image; raw commands and model-generated arguments remain unavailable.

The repository bind mount is now read-only. Only bounded tmpfs targets for caches and discarded build output are writable. Network is disabled, the root filesystem is read-only, capabilities are dropped, no-new-privileges and non-root execution are enforced, resources and output are bounded, no Docker socket is mounted, and the host runner never invokes a shell.

Profiles use fixed commands: npm scripts for Node, ruff/mypy/pytest/build for Python, vet/test/build for Go, and clippy/check/test/build for Rust. Images must contain required tools and dependencies before offline execution.

`certify:container` runs a real Node probe that attempts a workspace write and outbound connection. Certification succeeds only when both are denied and source/sandbox remain unchanged. Missing daemon or image is `runtime_unavailable`/failed, never certified.
