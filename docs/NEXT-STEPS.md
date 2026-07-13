# Next steps

KAVEEP DEV AGENT now runs as a local durable application with governance checks, indexed context retrieval, structured Engineering Brain edits, sandbox validation and repair, reviewed patches, explicit approval, journaled source apply, controlled local Git commits, per-session concurrency, DPAPI secrets, packaging, and scoped Local LLM runtime evidence.

The remaining gap to a broadly Codex-like standalone agent is broad live-runtime
evidence and production evaluation rather than core safety plumbing. A bounded
dynamic observe/reason/tool loop and governed interactive operation are already
implemented:

The evidence and release-decision criteria are tracked in
`docs/V1-ACCEPTANCE-MATRIX.md`.

1. Live-certify Node container isolation after Docker is available, then Python, Go, and Rust profiles with pinned offline images and representative fixtures.
2. Add eval suites for real bug-fix, refactor, test-writing, and multi-file tasks, with quality/cost/latency baselines.
3. Add signed migration and upgrade tooling before a 1.0 release.

Push, merge, remote PR creation, release publishing, deployment, governance mutation, and autonomous approval remain outside the standalone authority boundary.
