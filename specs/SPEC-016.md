# SPEC-016

## Reviewed Change and Patch Artifact

Owner: KAVEEP-DEV-AGENT

### Purpose

SPEC-016 converts verified sandbox changes into a deterministic, bounded, human-reviewable text patch artifact. It verifies that every changed source-backed file still matches the Secure Sandbox source snapshot before using current source content as the patch base.

### Behavior

The generator accepts an exact sandbox manifest, optional Engineering Proposal and Loop references, explicit protected paths, and strict file/byte/line limits. It detects sandbox changes, verifies source hashes, rejects source drift, reads only changed regular UTF-8 text files, and emits normalized add, modify, and delete entries plus a deterministic unified review patch and SHA-256 patch hash.

### Boundaries

The artifact is evidence only. It does not apply a patch, write to source, invoke Git, grant approval, satisfy POLICY or KCP, release, or deploy. Binary, oversized, linked, escaped, internal, sensitive, protected, or unverified changes fail closed. Patch output is intended for review and later exact-hash approval; it is not yet a source-write request.

### Acceptance criteria

- request and artifact schemas validate;
- add, modify, and delete text changes produce deterministic patch evidence;
- source drift, protected paths, links, binary data, and resource-limit overflow are blocked;
- patch hash changes whenever patch content changes;
- source repository remains unchanged;
- existing quality gates continue to pass.

