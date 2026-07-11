# SPEC-006

## Tool Orchestrator Capability

Owner: KAVEEP-DEV-AGENT

This capability is a deterministic default-deny gateway for explicitly registered in-process read-only engineering tools. It separates planning from invocation and owns local tool descriptors, requests, results, and audit-ready invocation records.

The registry never discovers executables, scans PATH, imports target-repository code, or replaces the KAVEEP-COMMAND-CENTER agent registry.

Only none and read_only side-effect classes may run. The initial inventory is repository.metadata, file.stat, file.read_text, and file.search_text. Each requires an explicit approved root; file tools reject path escape, symbolic links, directories, ignored paths, sensitive artifacts, oversized files, and non-text or binary content as applicable.

Unknown, disabled, unsupported, write-capable, shell, Git, network, approval-gated, policy-gated, and sandbox-gated tools are denied. Results normalize success, denial, failure, timing, warnings, errors, limitations, side effects, and recommended next action.

Tool availability is not authorization. Planning may propose Tool Requests but does not invoke them. POLICY, Approval Gateway, Secure Sandbox, write-capable tools, and autonomous execution remain outside this prototype.

Every handler invocation requires a schema-valid Execution Gate Result whose `toolRequestRef`, `requestRef`, and `planRef` correlate to the exact Tool Request. Only the compatible `decision: allow_read_only` and `status: evaluated` combination may proceed, and only when its evidence is present, applicable to that request, and has no unmet condition or protected action. Authorization is request-specific, never blanket or reusable. The Tool Orchestrator consumes this result without creating, modifying, or reinterpreting it and defaults to denial before handler invocation.
