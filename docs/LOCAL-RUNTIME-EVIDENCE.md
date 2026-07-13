# Local Runtime Evidence

Recorded: 2026-07-13

## Controlled Process Runner

Status: PASSED

`tools/test-controlled-process-runner.mjs` passed after the Git execution case
was moved to a temporary repository created by the test process. This preserves
the runner's prohibition on Git configuration overrides and avoids relying on
ownership of the developer checkout.

## Release Packaging

Status: PASSED

`tools/release-readiness.mjs` completed syntax validation and `npm pack --dry-run`
successfully. The package inventory contained 278 files. The readiness result
is still `preview_ready_with_blockers`: CurrentUser DPAPI is certified, while
live container isolation is not claimed because the Docker daemon is unavailable.

## Command Center

Status: PASSED

The local Command Center started on a loopback address and returned a successful
HTTP response. It remains a governed session surface; it grants no source-write,
Git-write, release, or deployment authority.

The bundled combined launcher waits for the local model endpoint before starting
the Command Center. It served the KOSINCHAI Control Center avatar as `image/png`
from the same loopback-only surface.

On 2026-07-13 the launched services were independently rechecked: `GET
/v1/models` on `127.0.0.1:8080` returned `kaveep-local`; the Command Center on
`127.0.0.1:8765` returned HTTP 200; and `POST /v1/chat/completions` returned
`KAVEEP launcher live.` to the exact-response probe (20 prompt tokens, 7
completion tokens).

After the Command Center cooperative-cancellation update, the launcher was
restarted and rechecked on the same loopback endpoints. The Command Center
returned HTTP 200 and served the `Cancel active session` control; the model
endpoint still returned the `kaveep-local` alias. The cancellation route itself
is covered by a deterministic SSE regression test, including the post-completion
`404` case that prevents cancellation of a non-active session.

## Local LLM

Status: PASSED — local runtime endpoint only

Verified model: `llama-3.2-3b-instruct-q4_k_m.gguf` (2,019,373,920 bytes).

`llama-server.exe` was started on `127.0.0.1:8080` with a 4,096-token context,
the agent/tool proxy features disabled, and the explicit `kaveep-local` alias.
The `/v1/models` endpoint returned that alias and `/v1/chat/completions` returned
the exact requested response: `KAVEEP local model ready.` Usage was 21 prompt
tokens and 8 completion tokens.

This certifies only the local model runtime and OpenAI-compatible endpoint. It
does not certify autonomous coding quality, source-write safety, production
operation, container validation, or the entire DEV-AGENT workflow.

## Local Engineering Workflow Probe

Status: BLOCKED (correctly recorded)

The read-only local-model evaluator was run against the configured endpoint
with container validation disabled and sandbox cleanup enabled. The original
100,000-character default produced an HTTP 400 because the request exceeded the
llama-server slot context. Local sessions now cap context at 12,000 characters
and 768 output tokens; the overflow did not recur. A fresh one-pass probe then
returned a proposal after roughly 119.5 seconds, but deterministic validation
rejected its extra top-level fields. The local adapter now supplies the allowed
top-level keys explicitly while keeping validation strict. A subsequent probe
completed in roughly 63.4 seconds but was rejected because its referenced
request/plan/context IDs did not correlate exactly. Engineering Brain now gives
those exact IDs in the system instruction; it still never rewrites provider
output. The next one-pass probe (`local_eval_0b44565a15f04e7ebea1faa11f19495a`)
ran for 64,577 ms and passed the reference correlation stage, then was rejected
because it set `proposalAuthorizesExecution` to true. The system instruction now
also requires `proposalAuthorizesExecution=false`, `requiresHumanApproval=true`,
and `status="proposed"` exactly; deterministic validation remains unchanged.
Sandbox cleanup completed and no source write was attempted. This is evidence
of an incomplete local coding-workflow certification, not a successful quality
result.
