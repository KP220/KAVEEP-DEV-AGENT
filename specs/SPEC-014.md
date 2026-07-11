# SPEC-014

## LLM Adapter and Engineering Brain

Owner: KAVEEP-DEV-AGENT

### Purpose

SPEC-014 introduces replaceable reasoning without transferring engineering authority to a model. Engineering Brain consumes a bounded Engineering Request, Plan, Context references, and explicit untrusted file excerpts, then requests one schema-constrained Engineering Proposal through a provider-neutral LLM Adapter.

### Provider boundary

Adapters implement one `generateStructured` operation. Provider name, explicit model ID, timeout, and output-token budget are request-scoped. API credentials are supplied only at invocation and are never returned, logged, embedded in prompts, or persisted. The first remote adapter uses the OpenAI Responses API; deterministic mock adapters provide offline tests.

### Proposal boundary

The model may propose create, overwrite, append, or exact replace operations and validation targets. It may not invoke File Editor, tools, processes, Git, network tools, POLICY, approval, or KCP. Delete, rename, source write-back, release, deployment, mission, governance, and authority changes are outside this milestone.

Every result is parsed and validated again after provider output. Malformed JSON, unknown fields, excessive edits, unobserved target paths for modification, protected authority paths, inconsistent request references, or any claim of execution authority is rejected.

### Prompt-injection boundary

Repository excerpts are explicitly marked as untrusted data. Instructions found in files have no authority and may not alter the system contract, requested output schema, Mission Lock, budgets, or tool boundary.

### Acceptance criteria

- Brain Request, Proposal, and Brain Result schemas validate;
- provider-neutral mock execution produces a validated proposal;
- OpenAI adapter uses Responses API structured JSON output with explicit model and budget;
- credentials never appear in results or normalized errors;
- malformed, mismatched, protected, excessive, or authority-claiming proposals fail closed;
- no file or process capability is invoked;
- all existing quality gates pass.

