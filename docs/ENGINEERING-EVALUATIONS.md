# Engineering evaluations

`src/evaluation/engineering-evaluation-runner.mjs` provides a deterministic
evaluation contract for four required task classes: bug fix, refactor, test
writing, and multi-file change. Each case must specify expected reviewed paths
and a latency budget. A passing result requires `awaiting_approval`, unchanged
source, an exact changed-path match, and a latency result inside its budget.

The current quality gates run both a deterministic scoring baseline and four
isolated Standalone Engineering Session workflows. The isolated suite produces
real sandboxed reviewed artifacts for each task class while using a deterministic
mock provider. Neither suite is live-model quality evidence.
Live benchmarks must record model/runtime identity, representative fixtures,
provider cost, latency, and reviewed artifacts without granting execution
authority.

For an explicitly scoped local-model probe, run:

```text
npm run evaluate:local-model -- C:\KAVEEP\data\config.json C:\KAVEEP\data\authority.json C:\KAVEEP\data\mission.json <task>
```

It uses the configured local endpoint for exactly one proposal attempt, disables
container validation for this measurement only, cleans its sandbox, and emits no
source write. Its result is endpoint/model evidence, not container certification
or a Version 1 decision.
