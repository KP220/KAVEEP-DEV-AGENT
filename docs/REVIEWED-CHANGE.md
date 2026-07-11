# Reviewed Change and Patch Artifact

Authority: SPEC-016

The generator converts current verified sandbox changes into a bounded deterministic text patch. Before reading a source-backed file, it verifies current source SHA-256 against the Secure Sandbox source snapshot. Any drift blocks the complete artifact.

Added, modified, and deleted UTF-8 files receive normalized before/after hashes, byte counts, patch sections, and one aggregate patch hash. Binary, linked, protected, oversized, escaped, sensitive, or unverified changes are rejected.

The artifact requires human approval and explicitly has `artifactAuthorizesSourceWrite: false`. It is review evidence, not an apply-patch command or Git artifact.

```text
npm run review:change -- <reviewed-change-request.json>
```
