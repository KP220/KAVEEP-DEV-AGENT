# Iterative Engineering Loop

Authority: SPEC-015

The loop connects Engineering Brain, Sandbox File Editor, and Node.js Static Validation. It is the first capability that can propose, apply, diagnose, and revise code changes while keeping every write inside a verified sandbox.

Each attempt has a unique Brain Request and preserves Brain Result, Edit Result, Diff, and Validation Result. Failed syntax output is bounded and returned as untrusted feedback. Context hashes are refreshed from current sandbox files before the next proposal.

Attempts are limited to one through five. Passing syntax produces reviewable evidence, not approval. Exhaustion stops safely. This module itself performs no build, source write-back, Git, release, or deployment; Standalone Session composes it with container validation and separately approved downstream workflows.

```text
OPENAI_API_KEY=<runtime-secret> npm run loop:run -- <loop-request.json>
```
