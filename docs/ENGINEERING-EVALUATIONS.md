# Engineering evaluations

`src/evaluation/engineering-evaluation-runner.mjs` provides a deterministic
evaluation contract for four required task classes: bug fix, refactor, test
writing, and multi-file change. Each case must specify expected reviewed paths
and a latency budget. A passing result requires `awaiting_approval`, unchanged
source, an exact changed-path match, and a latency result inside its budget.

The current quality gate runs a deterministic mock baseline. It proves the
scoring contract and its failure modes; it is not live-model quality evidence.
Live benchmarks must record model/runtime identity, representative fixtures,
provider cost, latency, and reviewed artifacts without granting execution
authority.
