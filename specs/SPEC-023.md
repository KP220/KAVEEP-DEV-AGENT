# SPEC-023

## Bounded Semantic Repair Loop

SPEC-023 feeds isolated lint, typecheck, test, and build failures back to the Engineering Brain. Diagnostics are untrusted evidence, truncated to `maxSemanticFeedbackCharacters`, and never interpreted as authority or tool instructions. Each repair still passes structured proposal checks, protected-path enforcement, sandbox-only editing, and static syntax validation before semantic validation runs again.

`semanticMaxAttempts` is capped at three. Runtime unavailability, policy blocks, and malformed results are not treated as code defects and never trigger speculative repair. Exhaustion blocks review readiness. Successful repair retains every container result as ordered audit evidence and generates the reviewed patch from the final verified sandbox state.

The loop grants no source-write, Git, release, or deployment authority.
