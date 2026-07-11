# SPEC-024

## Persistent Incremental Workspace Index

SPEC-024 adds a local, dependency-free index for repositories larger than the bounded initial inspection window. It indexes UTF-8 text only, never follows links, excludes sensitive names, dependencies, generated output, VCS data, binaries, and oversized files, and executes no repository code.

Snapshots are deterministic and atomically replaced. Unchanged entries are reused by size and modification time; content objects are addressed by SHA-256. Because metadata can be stale or manipulated, every search result is reread from the repository and its current SHA-256 must match before any snippet is returned. Stale entries are omitted and reported.

Search is deterministic lexical retrieval with path weighting, bounded result count, snippet size, and total context characters. Index output is advisory context, never authority, approval, or execution evidence. The store must be outside the indexed repository so it cannot become a proposed source change.

Standalone Session integration searches with the normalized user command, merges retrieved paths with deterministic Engineering Context, and reads the selected content again from the verified sandbox. Brain context limits remain the final bound.
