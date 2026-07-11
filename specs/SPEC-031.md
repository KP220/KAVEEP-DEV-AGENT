# SPEC-031

## Preview Packaging and Release Readiness

SPEC-031 defines an installable preview package and prevents unsupported production claims. The package exposes the `kaveep` binary, requires Node 22+, includes an explicit file allowlist, and remains versioned below 1.0 while production blockers exist.

Release assessment verifies manifest identity, required runtime/docs/spec files, syntax of shipped runtime/CLI modules, and npm dry-run inventory. It separately reports live container certification, OS-native secret storage, and concurrent durable-session scaling.

`preview_ready_with_blockers` means the package can be evaluated locally under documented constraints. Only an empty blocker set may produce `production_ready`. Quality gates alone cannot override missing live isolation evidence or unsupported scalability/security capabilities.
