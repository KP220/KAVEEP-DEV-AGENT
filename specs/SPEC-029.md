# SPEC-029

## One-command Standalone Run, Status, Recovery, and Cancellation

SPEC-029 turns the component workflow into the primary `kaveep` application surface. `run` loads versioned config, executes the environment doctor, correlates Authority Snapshot and Mission Lock, creates a bounded request, initializes the durable session store, resolves the provider secret only in memory, and runs the full standalone engineering session.

`status` verifies the durable hash chain without provider or container access. `recover` reruns readiness checks and starts a linked attempt from `received`, forcing governance drift checks against current state. `cancel` verifies the chain and cleans the retained sandbox. No command silently skips a required doctor failure, governance check, container requirement, approval, or recovery invariant.

Terminal success for coding remains `awaiting_approval`; source apply and Git commit retain their separate interactive approvals.
