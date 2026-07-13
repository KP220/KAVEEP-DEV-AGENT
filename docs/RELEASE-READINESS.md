# Release readiness

Run `npm run release:readiness` to audit the installable preview. Current
versioning remains `0.x`: Windows CurrentUser DPAPI and the scoped local LLM
runtime endpoint have live evidence. The live Node container-isolation check is
currently blocked because the Docker daemon is unavailable. Interactive
streaming UX and live Python/Go/Rust profile certification remain incomplete.

The preview is usable for local evaluation when all 28+ quality gates pass and the readiness report says `installablePreview: true`. This is not equivalent to production certification.

Set `KAVEEP_CONTAINER_CERTIFICATION_STATUS=certified` and
`KAVEEP_DPAPI_CERTIFICATION_STATUS=certified` only from verified certification
results generated on the target runtime. Never set them merely to bypass a
blocker.
