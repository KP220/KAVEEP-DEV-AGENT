# Standalone Engineering Session

SPEC-021 connects the existing safety and execution components into one local engineering session:

`governance check → repository analysis → verified sandbox → Engineering Brain → static validation loop → isolated semantic validation → reviewed patch`

The session deliberately stops at `awaiting_approval`. It does not write to the source repository, commit, push, release, or deploy. The retained sandbox and exact patch hash are review evidence; they grant no authority.

When `loop.semanticMaxAttempts` is greater than zero, isolated semantic failures are returned to the Brain as bounded untrusted evidence. Runtime outages never trigger repair. Every attempt remains available in `artifacts.containerValidationAttempts`.

Set `workspaceIndex.enabled` and an `indexRoot` outside the repository to build/reuse the persistent incremental index. Retrieval uses the user command, verifies current source hashes, and then reloads selected files from the verified sandbox under the normal Brain context budget.

## Run locally

1. Copy `examples/standalone-session-request.example.json` and set `repositoryRoot`, the verified Authority Snapshot, Mission Lock, explicit model, container image allowlist, and budgets.
2. Start the supported container runtime when semantic validation is required.
3. Set `OPENAI_API_KEY` only in the process environment. Never place it in the request or result file.
4. Run `npm run session:run -- request.json result.json`.
5. Review `artifacts.reviewedChange.patch`, its `patchSha256`, validation evidence, warnings, and errors.
6. Use the separate signed approval and controlled write workflow only after human approval.

The output file uses exclusive creation and will not overwrite an existing audit artifact. A required but unavailable container runtime blocks the session instead of silently executing repository code on the host.

## Durable operation

Use `npm run session:durable -- start <store> <request.json>` to create the store and run an audited session. Use `replay <store> <session-id>` to verify its hash chain, `recover <store> <session-id>` to create a linked attempt that restarts at `received`, and `cancel <store> <session-id>` to verify and clean its retained sandbox. Only `start` and `recover` require `OPENAI_API_KEY`.

Recovery never resumes inside an earlier stage. It reruns governance against the current repository before analysis. Corruption blocks recovery and cancellation mutation.

## Review and controlled local apply

After a session reaches `awaiting_approval`:

1. Run `npm run workflow:local -- review <session-result.json>` and inspect the complete patch and SHA-256.
2. Set `KAVEEP_APPROVAL_SIGNING_SECRET` in the interactive terminal environment. Do not put it in JSON, shell history, logs, or the repository.
3. Run `npm run workflow:local -- approve <session-result.json> <reviewer-id> <bundle.json>` and type `APPROVE <full patch SHA-256>` at the prompt. Piped stdin is rejected.
4. Run `npm run workflow:local -- apply <session-result.json> <session-request.json> <bundle.json> <approval-ledger> <transactions> <write-ledger>`.

The approval bundle file is created exclusively and is short-lived, signed, exact-hash bound, and one-time. Apply revalidates the patch and source snapshot, records approval consumption, creates external rollback backups and a durable journal, verifies post-write hashes, and performs no Git operation.

Keep all three ledger/transaction directories outside the source repository and protect them with operating-system permissions. Losing the signing secret does not justify bypassing verification; create a new review and approval under the replacement trust configuration.

## Controlled local Git commit

After controlled apply completes, save its JSON output and create a separate Git approval:

1. `npm run workflow:local -- git-approve <session-result.json> <reviewer-id> <git-bundle.json>`
2. Type `COMMIT <full patch SHA-256>` interactively.
3. `npm run workflow:local -- git-commit <repository> <session-result.json> <apply-result.json> <git-bundle.json> <git-approval-ledger> <kaveep/branch> "<message>"`

The Git index must be empty before the operation. Only Reviewed Change paths are staged and committed; unrelated unstaged files remain untouched. The command can create one `kaveep/*` branch and one local commit. It cannot contact remotes or perform push, pull, fetch, merge, rebase, reset, tag, release, or deployment operations.

## Current production gaps

- Durable state is local and crash-safe, but multi-machine coordination is not supported.
- The Docker security contract is unit-tested, but live integration requires a running daemon.
- The CLI currently supports the OpenAI Responses adapter; the runtime itself remains provider-neutral.
- Semantic repair is bounded to three attempts and currently re-sends the selected context rather than using a repository-wide incremental index.
