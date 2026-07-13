# Signed migrations

`src/migration/signed-json-migration.mjs` is an explicit JSON migration
primitive. A plan requires a human-approval marker, HMAC signature, expiry,
relative paths, and exact before/after SHA-256 hashes. Apply prepares every
artifact before renaming any file, reverses already-committed artifacts if a
later commit fails, and a prior migration cannot be replayed once its before
hash has changed.

The primitive does not discover, sign, or approve migrations. The signing secret
must remain external. A real upgrade still requires a reviewed transform, a
target-specific signed plan, backups, and an explicit release decision.
