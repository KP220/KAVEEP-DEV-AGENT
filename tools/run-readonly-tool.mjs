import { ToolRegistry } from "../src/tools/tool-registry.mjs";
import { invokeReadOnlyTool, registerBuiltInTools } from "../src/tools/tool-orchestrator.mjs";
import { evaluateExecutionGate } from "../src/gates/execution-gate.mjs";

const [toolId, approvedRoot, ...rest] = process.argv.slice(2);
const evidence = { evidenceId: "evidence_cli_001", evidenceType: "tool_request", verificationStatus: "verified", sourceType: "report", createdAt: new Date(0).toISOString(), summary: "Explicit CLI read-only request." };
const request = { toolRequestId: "tool_request_cli_001", schemaVersion: "1.0.0", toolId, toolVersion: "1.0.0", requestRef: "request_cli_001", planRef: "plan_cli_001", contextRef: "context_cli_001", repositoryIntelligenceRef: "repo_intel_cli_001", requestedOperation: toolId === "file.read_text" ? "read" : toolId === "file.search_text" ? "search" : "inspect", arguments: toolId === "file.search_text" ? { query: rest[0], paths: rest.slice(1) } : { path: rest[0] }, approvedRoot, expectedOutput: "Structured read-only result.", timeoutMs: 5000, policyEvaluationRefs: [], approvalRequestRefs: [], evidenceRefs: [evidence], auditRefs: [], status: "ready", createdAt: new Date(0).toISOString() };
const plan = { planId: request.planRef, requestId: request.requestRef, status: "proposed", safety: { planAuthorizesExecution: false, protectedActions: [] } };
const gateResult = evaluateExecutionGate(plan, request);
const result = await invokeReadOnlyTool(registerBuiltInTools(new ToolRegistry()), request, gateResult);
process.stdout.write(JSON.stringify({ request, gateResult, toolResult: result }, null, 2) + "\n");
if (result.status !== "succeeded") process.exitCode = 1;
