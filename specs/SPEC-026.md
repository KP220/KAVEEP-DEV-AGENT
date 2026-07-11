# SPEC-026

## Controlled Local Git Branch and Commit

SPEC-026 adds local-only Git branch, stage, and commit after a completed controlled source write. Git approval is separate from source-write approval and requires the human to type `COMMIT <full patch SHA-256>`.

The runner accepts only fixed argument arrays with no shell. It verifies the repository top-level, current source hashes, completed write evidence, empty pre-existing Git index, bounded `kaveep/*` branch name, single-line commit message, and exact staged path set. It creates a new branch and one commit. Push, fetch, pull, merge, rebase, reset, checkout of paths, tags, remotes, release, and deployment are unavailable.

Unrelated unstaged user work is neither staged nor committed. Any pre-existing staged work blocks the operation. Approval is signed, short-lived, exact-hash-bound, and consumed once before mutation.
