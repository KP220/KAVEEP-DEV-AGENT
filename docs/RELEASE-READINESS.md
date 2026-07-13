# Release readiness

Run `npm run release:readiness` to audit the installable preview. Current
versioning remains `0.x`: Windows CurrentUser DPAPI and the scoped local LLM
runtime endpoint have live evidence. Command Center streaming, compact result
views, human-approval presentation, and cooperative cancellation are covered by
regression tests. The live Node container-isolation check is currently blocked
because the Docker daemon is unavailable; live Python/Go/Rust profile
certification also remains incomplete.

The preview is usable for local evaluation when all registered quality gates pass and the readiness report says `installablePreview: true`. This is not equivalent to production certification.

Set `KAVEEP_CONTAINER_CERTIFICATION_STATUS=certified` and
`KAVEEP_DPAPI_CERTIFICATION_STATUS=certified` only from verified certification
results generated on the target runtime. Never set them merely to bypass a
blocker.
