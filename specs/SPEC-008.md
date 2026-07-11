# SPEC-008

## Secure Sandbox Foundation

Owner: KAVEEP-DEV-AGENT

### Purpose and scope

Secure Sandbox creates a unique isolated temporary workspace from an explicitly approved repository root so future change-capable engineering components never operate directly on the source repository. This milestone provides preparation, manifests, bounded snapshots, sandbox-only change detection, and verified cleanup. It provides no editor, process runner, shell, Git, network, dependency installation, deployment, autonomous execution, or write-back.

### Identity and lifecycle

Each preparation has a `sandbox_request_*`, a narrow correlated Execution Gate Result, an unpredictable `sandbox_*` identity, a unique operating-system temporary root, a Sandbox Manifest, and a Sandbox Result. Lifecycle states are proposed, preparing, ready or ready_with_warnings, then explicit cleaned; blocked, failed, expired, no_action, and unverified preserve safe outcomes. Ready means isolated workspace preparation succeeded. It is not approval to modify the source or write back.

### Approved source and destination boundaries

The source root must be explicitly supplied, exist, resolve canonically to a directory, and be narrower than a drive root, system root, or entire home directory. It is the only copy source. Traversal escape and terminal or nested links are rejected or excluded. The manager creates the destination with safe Node.js temporary-directory APIs and an unpredictable suffix. The canonical destination must differ from and remain outside the source. No caller selects an arbitrary destination.

### Workspace preparation and copy policy

`selected_context_copy` copies only explicitly selected permitted paths. `bounded_repository_copy` traverses the approved root. Explicit exclusions and the shared ignored-name policy exclude VCS, dependency, generated, cache, build, virtual-environment, and temporary paths. Exclusion is recorded and does not claim irrelevance. Directories and files are copied deterministically without executing repository content.

Sensitive-looking environment, credential, password, token, secret, private-key, SSH-key, and private-certificate artifacts are excluded. Their contents are neither read, hashed, nor copied. Symbolic links, junctions, and unsupported link-like entries are not followed; safe metadata records exclusions and limitations.

### Resource limits

Every request bounds files, directories, total bytes, single-file bytes, traversal depth, path length, and lifetime. Limits have conservative schema maxima. Reaching a limit stops the affected copy safely and produces explicit warnings and `ready_with_warnings` when a bounded partial workspace remains available. Required content is never silently omitted.

### Manifest, original snapshot, and change detection

The manifest records canonical roots, identity, mode, expiry, copied files/directories, all exclusion categories, totals, limits, warnings, limitations, evidence, and audit references. Before copying permitted files, the manager records relative path, type, size, modification timestamp, and SHA-256 content hash. Sensitive contents are never hashed. This bounded snapshot is change evidence, not Git.

Sandbox Change Detector compares that original permitted snapshot with the current isolated workspace and reports added, modified, deleted, unchanged, excluded, and unverified entries plus resource-limit effects. It never changes or writes back to the source.

### Cleanup and failure recovery

Production-facing cleanup is explicit. It accepts only the exact manifest path and verifies the canonical temporary-root boundary, manager prefix, sandbox identity, source identity, and internal unpredictable marker before deleting exactly that sandbox root. Source roots, arbitrary directories, broad temporary cleanup, and unknown sandboxes are rejected. Preparation failure removes a partially created workspace. Tests may use automatic cleanup only for their own verified sandboxes.

### Authorization and integration boundaries

Execution Gate owns evaluation and may emit only the narrow `allow_sandbox_preparation` decision for an exact Sandbox Request, request, and plan correlation with verified evidence and a non-authorizing plan. That decision permits bounded isolated copying only. It grants no protected execution, editing, process execution, approval, or write-back.

Secure Sandbox Manager consumes but does not reinterpret the Gate Result. Tool Orchestrator does not automatically route sandbox creation or cleanup in this milestone. Planning and LLM paths cannot trigger it. A future File Editor must write only inside a verified sandbox and requires a separate milestone. A future Process Runner requires separate policy, approval, and execution controls. Humans retain protected-action approval; KAVEEP-POLICY retains governance.

### Acceptance criteria

- canonical Sandbox Request, Manifest, and Result validate;
- an exact gate-authorized request creates a unique bounded isolated workspace outside the source;
- unsafe broad roots, missing roots, non-directory roots, escapes, sensitive artifacts, and links default to block or exclusion;
- ignored paths and all exclusions are recorded;
- source snapshot and sandbox-only change detection are deterministic and bounded;
- source content remains unchanged;
- cleanup deletes only a marker-verified manager-created sandbox;
- examples, failure cases, prior tests, CLI creation, CLI cleanup, and whitespace validation pass;
- no shell, process, build, test, Git, network, LLM, dependency, deployment, engineering write tool, external write-back, or human approval is introduced.
