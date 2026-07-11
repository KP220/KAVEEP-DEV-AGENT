# Container Build and Test Runner

Authority: SPEC-020

The runner supports fixed `node`, `python`, `go`, and `rust` profiles for `lint`, `typecheck`, `test`, and `build`. Raw commands, model-generated arguments, host dependency installation, host Docker socket mounts, secrets, and network access are unavailable. Profile images must be explicitly allowlisted and already contain offline dependencies/tools.

Containers run with `--network none`, read-only root and repository mount, all capabilities dropped, no-new-privileges, non-root UID/GID, CPU/memory/PID limits, bounded tmpfs caches/output, timeout, output limits, and CID tracking. Missing Node scripts or project manifests are reported as skipped.

```text
npm run validate:container -- <container-validation-request.json>
```

Docker Desktop is installed in the current development environment but its daemon could not be started by the available session. Mock security tests pass; live container integration remains an environment-dependent gate and must pass before production enablement.

With a preloaded Node image and running daemon, certify real isolation using `npm run certify:container -- node:22-bookworm-slim`. A report is certified only if attempted workspace write and outbound network access are both denied.
