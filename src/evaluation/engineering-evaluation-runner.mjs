const taskTypes = new Set(["bug_fix", "refactor", "test_writing", "multi_file"]);
const terminalStatuses = new Set(["awaiting_approval", "no_action", "blocked", "failed", "cancelled"]);

function assertCase(item) {
  if (!item || typeof item !== "object" || !/^[A-Za-z0-9_-]+$/.test(item.caseId ?? "")) throw new Error("Evaluation case requires a safe caseId.");
  if (!taskTypes.has(item.taskType)) throw new Error(`Unsupported evaluation task type: ${item.taskType}.`);
  if (typeof item.command !== "string" || !item.command.trim()) throw new Error("Evaluation case requires a command.");
  if (!Array.isArray(item.expectedChangedPaths) || !item.expectedChangedPaths.length || item.expectedChangedPaths.some((value) => typeof value !== "string" || !value)) throw new Error("Evaluation case requires expected changed paths.");
  if (!Number.isInteger(item.maxLatencyMs) || item.maxLatencyMs < 1) throw new Error("Evaluation case requires a positive maxLatencyMs.");
}

function assertExecution(value) {
  if (!value || !terminalStatuses.has(value.status) || typeof value.sourceUnchanged !== "boolean" || !Number.isFinite(value.durationMs) || value.durationMs < 0) throw new Error("Evaluation executor returned an invalid result.");
  if (value.usage && (!Number.isInteger(value.usage.inputTokens ?? 0) || !Number.isInteger(value.usage.outputTokens ?? 0))) throw new Error("Evaluation token usage is invalid.");
}

function compact(value) {
  return {
    status: value.status,
    durationMs: value.durationMs,
    usage: { inputTokens: value.usage?.inputTokens ?? 0, outputTokens: value.usage?.outputTokens ?? 0 },
    sourceUnchanged: value.sourceUnchanged,
    changedPaths: [...new Set(value.changedPaths ?? [])].sort(),
    error: value.error ?? null
  };
}

export async function runEngineeringEvaluationSuite(cases, executeCase, options = {}) {
  if (!Array.isArray(cases) || !cases.length || typeof executeCase !== "function") throw new Error("Evaluation suite requires cases and an executor.");
  const seenIds = new Set();
  for (const item of cases) {
    assertCase(item);
    if (seenIds.has(item.caseId)) throw new Error(`Duplicate evaluation case: ${item.caseId}.`);
    seenIds.add(item.caseId);
  }
  const types = new Set(cases.map((item) => item.taskType));
  for (const type of taskTypes) if (!types.has(type)) throw new Error(`Evaluation suite is missing required task type: ${type}.`);
  const startedAt = (options.clock?.() ?? new Date()).toISOString();
  const results = [];
  for (const item of cases) {
    const execution = compact(await executeCase(structuredClone(item)));
    assertExecution(execution);
    const pathMatch = JSON.stringify(execution.changedPaths) === JSON.stringify([...item.expectedChangedPaths].sort());
    const passed = execution.status === "awaiting_approval" && execution.sourceUnchanged && execution.durationMs <= item.maxLatencyMs && pathMatch;
    results.push({ caseId: item.caseId, taskType: item.taskType, passed, expectedChangedPaths: [...item.expectedChangedPaths].sort(), observed: execution, findings: [
      ...(execution.status === "awaiting_approval" ? [] : [`Unexpected terminal status: ${execution.status}.`]),
      ...(execution.sourceUnchanged ? [] : ["Source repository changed during evaluation."]),
      ...(execution.durationMs <= item.maxLatencyMs ? [] : [`Latency budget exceeded: ${execution.durationMs}ms > ${item.maxLatencyMs}ms.`]),
      ...(pathMatch ? [] : ["Reviewed changed paths did not match the evaluation expectation."])
    ] });
  }
  const passedCases = results.filter((item) => item.passed).length;
  return {
    evaluationSuiteId: options.evaluationSuiteId ?? "engineering_evaluation_suite",
    schemaVersion: "1.0.0",
    status: passedCases === results.length ? "passed" : "failed",
    caseCount: results.length,
    passedCases,
    failedCases: results.length - passedCases,
    aggregateUsage: results.reduce((usage, item) => ({ inputTokens: usage.inputTokens + item.observed.usage.inputTokens, outputTokens: usage.outputTokens + item.observed.usage.outputTokens }), { inputTokens: 0, outputTokens: 0 }),
    maxObservedLatencyMs: Math.max(...results.map((item) => item.observed.durationMs)),
    results,
    limitations: ["This runner scores supplied execution evidence; it does not authorize source writes, Git, releases, deployments, or provider access.", "A deterministic mock baseline is not evidence of live-model coding quality."],
    startedAt,
    completedAt: (options.clock?.() ?? new Date()).toISOString()
  };
}
