# SPEC-028

## Local Configuration, Secret Boundary, and Environment Doctor

SPEC-028 creates a versioned standalone configuration with an explicit repository, external data root, durable stores, provider/model, execution profile/image allowlist, and bounded defaults. Config creation rejects secret-like keys and refuses nested or overlapping repository/data roots.

Secrets are references only. The initial provider resolves `OPENAI_API_KEY` from the process environment into a non-enumerable in-memory `SecretValue`; string and JSON conversion are always redacted. Config, doctor reports, durable stores, and logs never contain the resolved value. OS-native credential-store adapters remain a later hardening option and must preserve the same interface.

The environment doctor verifies config/path isolation, Node version, Git, Docker daemon, writable durable roots, explicit model, and secret availability. Missing required container runtime or provider secret blocks standalone readiness rather than silently degrading safety.
