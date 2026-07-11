# SPEC-021

## Standalone Engineering Session

SPEC-021 composes the verified local capabilities into one command-driven session. A session runs governance checks, interpretation, repository inspection, context selection, planning, sandbox preparation, Engineering Brain iteration, static/container validation, and Reviewed Change generation. It stops at `awaiting_approval`; source write-back is never automatic.

Session progress is ordered and explicit. Terminal outcomes are `awaiting_approval`, `no_action`, `blocked`, and `failed`. The session retains its sandbox for review/recovery and returns the exact manifest reference. Container validation may be required by configuration; unavailable or failed runtime blocks approval readiness.

The first session milestone is in-process. Durable session resume and cancellation build on SPEC-012 in the next increment. KAVEEP-COMMAND-CENTER ownership is not duplicated; this is standalone/local engineering coordination only.
