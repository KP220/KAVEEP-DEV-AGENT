import assert from "node:assert/strict";
import { runEngineeringEvaluationSuite } from "../src/evaluation/engineering-evaluation-runner.mjs";

const clock = () => new Date("2026-07-13T00:00:00.000Z");
const cases = [
  { caseId: "bug_fix_001", taskType: "bug_fix", command: "Fix null input validation.", expectedChangedPaths: ["src/validator.mjs"], maxLatencyMs: 100 },
  { caseId: "refactor_001", taskType: "refactor", command: "Extract shared normalization helper.", expectedChangedPaths: ["src/normalizer.mjs"], maxLatencyMs: 100 },
  { caseId: "test_writing_001", taskType: "test_writing", command: "Add boundary test coverage.", expectedChangedPaths: ["test/validator.test.mjs"], maxLatencyMs: 100 },
  { caseId: "multi_file_001", taskType: "multi_file", command: "Update API and its consumer.", expectedChangedPaths: ["src/api.mjs", "src/client.mjs"], maxLatencyMs: 100 }
];
const baseline = await runEngineeringEvaluationSuite(cases, async (item) => ({ status: "awaiting_approval", sourceUnchanged: true, durationMs: 25, usage: { inputTokens: 10, outputTokens: 5 }, changedPaths: item.expectedChangedPaths }), { clock, evaluationSuiteId: "deterministic_baseline_001" });
assert.equal(baseline.status, "passed");
assert.equal(baseline.caseCount, 4);
assert.equal(baseline.passedCases, 4);
assert.deepEqual(baseline.aggregateUsage, { inputTokens: 40, outputTokens: 20 });
const failed = await runEngineeringEvaluationSuite(cases, async (item) => ({ status: "awaiting_approval", sourceUnchanged: item.caseId !== "bug_fix_001", durationMs: item.caseId === "refactor_001" ? 101 : 25, changedPaths: item.caseId === "test_writing_001" ? ["wrong.mjs"] : item.expectedChangedPaths }), { clock });
assert.equal(failed.status, "failed");
assert.equal(failed.passedCases, 1);
await assert.rejects(() => runEngineeringEvaluationSuite(cases.slice(0, 3), async () => ({})), /missing required task type/);
await assert.rejects(() => runEngineeringEvaluationSuite([...cases, cases[0]], async () => ({})), /Duplicate evaluation case/);
console.log("PASSED engineering evaluation runner; four required task types; quality, latency, usage, and source-integrity baseline");
