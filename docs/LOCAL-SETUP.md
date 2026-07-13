# Local standalone setup

Initialize KAVEEP with a data root outside the repository:

```text
npm run kaveep -- init <config.json> <repository> <data-root> <explicit-model-id> node node:22-bookworm-slim
```

The command creates isolated roots for sessions, workspace index, approval ledgers, write transactions, and Git approval evidence. It never writes an API key to config.

Set `OPENAI_API_KEY` only in the process environment and start Docker Desktop when container validation is required. Then run:

```text
npm run kaveep -- doctor <config.json>
```

For the local Command Center, run `tools\KAVEEP-Command-Center.cmd` on Windows.
It serves only the local governed session UI; it does not grant write, Git, or
deployment authority.

Standalone readiness requires valid config isolation, Node 22+, Git, a running Docker daemon, writable data roots, an explicit model, and an available provider secret. Doctor output contains only `[REDACTED]`, never the secret value.

Generate a complete bounded session request from verified governance artifacts:

```text
npm run kaveep -- request <config.json> <authority-snapshot.json> <mission-lock.json> <request.json> <engineering command...>
```

The command requires exact repository/snapshot/lock correlation and creates the output exclusively. Run the result with `session:run` or `session:durable`.

For the normal one-command workflow, run:

```text
npm run kaveep -- run <config.json> <authority-snapshot.json> <mission-lock.json> <engineering command...>
```

The output includes the durable session ID. Inspect it later with `kaveep status <config.json> <session-id>`, restart safely with `recover`, or verify and clean it with `cancel`. Recovery always begins at `received` and reruns governance.

On Windows, set `OPENAI_API_KEY` temporarily and run `npm run kaveep -- secret-import <config.json>`. KAVEEP protects it with CurrentUser DPAPI, stores only ciphertext under the external data root, and updates config to the `windows-dpapi` reference. Do not place secrets in JSON files, command arguments, shell history, repository files, durable artifacts, or logs.
