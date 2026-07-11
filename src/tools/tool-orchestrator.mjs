import { lstat, readFile, stat } from "node:fs/promises";
import { resolveReadOnlyPath, defaultOptions } from "../repository/repository-intelligence.mjs";

const now = () => new Date(0).toISOString();
const message = (code, message, path) => path ? { code, message, path } : { code, message };
const id = (prefix, value) => `${prefix}_${String(value ?? "unknown").replace(/[^A-Za-z0-9_-]/g, "_").replace(/^_+/, "") || "unknown"}`;
const textExtensions = new Set([".md", ".txt", ".json", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".yml", ".yaml", ".xml", ".toml", ".css", ".html"]);
const validDate = value => typeof value === "string" && !Number.isNaN(Date.parse(value));

function validateReference(value, type) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Tool Request ${type} reference is invalid.`);
  const evidenceFields = ["evidenceId", "evidenceType", "verificationStatus", "sourceType", "createdAt", "sourceRef", "summary", "hash", "confidence", "metadata"];
  const auditFields = ["auditId", "auditType", "result", "riskLevel", "createdAt", "correlationId", "eventId", "sessionId", "summary", "metadata"];
  const fields = type === "evidence" ? evidenceFields : auditFields;
  if (Object.keys(value).some(field => !fields.includes(field))) throw new Error(`Tool Request ${type} reference is invalid.`);
  if (type === "evidence") {
    if (!/^evidence_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value.evidenceId) || typeof value.evidenceType !== "string" || !value.evidenceType || !["verified", "unverified", "rejected", "deprecated", "superseded"].includes(value.verificationStatus) || !["document", "report", "event", "audit", "human_input", "system_observation", "external_reference", "generated_analysis"].includes(value.sourceType) || !validDate(value.createdAt)) throw new Error("Tool Request evidence reference is invalid.");
  } else if (!/^audit_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value.auditId) || typeof value.auditType !== "string" || !value.auditType || !["success", "failed", "blocked", "pending", "requires_approval", "unverified"].includes(value.result) || !["low", "moderate", "high", "critical"].includes(value.riskLevel) || !validDate(value.createdAt)) throw new Error("Tool Request audit reference is invalid.");
}

function descriptor(toolId, capabilityType, operationType) {
  return { toolId, name: toolId, version: "1.0.0", description: "Explicit DEV-AGENT read-only in-process tool.", owner: "KAVEEP-DEV-AGENT", capabilityType, operationType, sideEffectClass: "read_only", riskClass: "low", inputSchemaRef: "schemas/tool-request.schema.json", outputSchemaRef: "schemas/tool-result.schema.json", requiresPolicyEvaluation: false, requiresHumanApproval: false, sandboxRequired: false, networkRequired: false, supported: true, enabled: true, limitations: ["Read-only prototype only."], tags: ["read-only", "deterministic"] };
}

function assertArguments(request, names) {
  if (!request.arguments || typeof request.arguments !== "object") throw new Error("Tool Request arguments must be an object.");
  for (const name of names) if (typeof request.arguments[name] !== "string" || !request.arguments[name].trim()) throw new Error(`Tool Request argument ${name} is required.`);
}

async function safeFile(request, requireText = false) {
  assertArguments(request, ["path"]);
  const info = await resolveReadOnlyPath(request.approvedRoot, request.arguments.path);
  if (!info.entry.isFile()) throw new Error("Requested path must be a regular file.");
  if (info.sensitive) throw new Error("Sensitive artifact access is denied.");
  if (info.ignored) throw new Error("Ignored artifact access is denied.");
  const metadata = await stat(info.canonicalPath);
  if (metadata.size > defaultOptions.maxReadableFileSizeBytes) throw new Error("File exceeds the read-only size limit.");
  if (requireText && !textExtensions.has(info.relativePath.slice(info.relativePath.lastIndexOf(".")).toLowerCase())) throw new Error("File is not an allowed text artifact.");
  return { info, metadata };
}

export const builtInTools = [
  { descriptor: descriptor("repository.metadata", "repository_metadata", "inspect"), handler: async (request) => {
    const info = await resolveReadOnlyPath(request.approvedRoot, ".");
    return { repositoryRoot: info.canonicalRoot, repositoryName: info.canonicalRoot.split(/[\\/]/).pop(), readOnly: true };
  }},
  { descriptor: descriptor("file.stat", "file_metadata", "inspect"), handler: async (request) => {
    const { info, metadata } = await safeFile(request);
    return { path: info.relativePath, type: "file", sizeBytes: metadata.size };
  }},
  { descriptor: descriptor("file.read_text", "file_content", "read"), handler: async (request) => {
    const { info, metadata } = await safeFile(request, true);
    const content = await readFile(info.canonicalPath, "utf8");
    if (content.includes("\u0000")) throw new Error("Binary file access is denied.");
    return { path: info.relativePath, content, sizeBytes: metadata.size, truncated: false };
  }},
  { descriptor: descriptor("file.search_text", "text_search", "search"), handler: async (request) => {
    assertArguments(request, ["query"]);
    const paths = request.arguments.paths;
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > 20) throw new Error("Search requires 1 to 20 explicit paths.");
    const matches = [];
    for (const target of paths) {
      const copy = { ...request, arguments: { path: target } };
      const { info } = await safeFile(copy, true);
      const content = await readFile(info.canonicalPath, "utf8");
      if (content.includes("\u0000")) continue;
      content.split(/\r?\n/).forEach((line, index) => {
        if (line.includes(request.arguments.query) && matches.length < 100) matches.push({ path: info.relativePath, line: index + 1, text: line });
      });
      if (matches.length >= 100) break;
    }
    return { query: request.arguments.query, matches, truncated: matches.length >= 100 };
  }}
];

export function registerBuiltInTools(registry) {
  for (const entry of builtInTools) registry.register(entry.descriptor, entry.handler);
  return registry;
}

export function validateToolRequest(request) {
  if (!request || typeof request !== "object") throw new Error("Tool Request object is required.");
  const fields = ["toolRequestId", "schemaVersion", "toolId", "toolVersion", "requestRef", "planRef", "contextRef", "repositoryIntelligenceRef", "requestedOperation", "arguments", "approvedRoot", "expectedOutput", "timeoutMs", "policyEvaluationRefs", "approvalRequestRefs", "evidenceRefs", "auditRefs", "status", "createdAt"];
  if (Object.keys(request).some(field => !fields.includes(field))) throw new Error("Tool Request contains unsupported self-authorization or unknown fields.");
  for (const field of ["toolRequestId", "schemaVersion", "toolId", "toolVersion", "requestRef", "planRef", "contextRef", "repositoryIntelligenceRef", "requestedOperation", "approvedRoot", "expectedOutput", "status", "createdAt"]) {
    if (!request[field] || typeof request[field] !== "string") throw new Error(`Tool Request ${field} is required.`);
  }
  const patterns = { toolRequestId:/^tool_request_[A-Za-z0-9][A-Za-z0-9_-]*$/, schemaVersion:/^[0-9]+\.[0-9]+\.[0-9]+$/, toolId:/^[a-z][a-z0-9_.-]*$/, toolVersion:/^[0-9]+\.[0-9]+\.[0-9]+$/, requestRef:/^request_[A-Za-z0-9][A-Za-z0-9_-]*$/, planRef:/^plan_[A-Za-z0-9][A-Za-z0-9_-]*$/, contextRef:/^context_[A-Za-z0-9][A-Za-z0-9_-]*$/, repositoryIntelligenceRef:/^repo_intel_[A-Za-z0-9][A-Za-z0-9_-]*$/ };
  for (const [field, pattern] of Object.entries(patterns)) if (!pattern.test(request[field])) throw new Error(`Tool Request ${field} is invalid.`);
  if (!request.arguments || typeof request.arguments !== "object" || Array.isArray(request.arguments)) throw new Error("Tool Request arguments must be an object.");
  for (const field of ["policyEvaluationRefs", "approvalRequestRefs", "evidenceRefs", "auditRefs"]) if (!Array.isArray(request[field])) throw new Error(`Tool Request ${field} must be an array.`);
  if (request.policyEvaluationRefs.some(value => typeof value !== "string") || request.approvalRequestRefs.some(value => typeof value !== "string")) throw new Error("Tool Request authorization references are invalid.");
  request.evidenceRefs.forEach(value => validateReference(value, "evidence"));
  request.auditRefs.forEach(value => validateReference(value, "audit"));
  if (!["inspect", "read", "search"].includes(request.requestedOperation) || !["proposed", "ready", "blocked", "no_action", "unverified", "unsupported"].includes(request.status) || !validDate(request.createdAt)) throw new Error("Tool Request has an invalid schema value.");
  if (!Number.isInteger(request.timeoutMs) || request.timeoutMs < 1 || request.timeoutMs > 30000) throw new Error("Tool Request timeoutMs must be between 1 and 30000.");
}

export function validateExecutionGateResult(gateResult, request) {
  if (!gateResult || typeof gateResult !== "object" || Array.isArray(gateResult)) throw new Error("Execution Gate Result is required.");
  const fields = ["gateResultId", "schemaVersion", "requestRef", "planRef", "toolRequestRef", "policyEvaluationRefs", "riskAssessmentRefs", "approvalRequestRefs", "evidenceRefs", "auditRefs", "protectedActions", "requiredConditions", "unmetConditions", "status", "decision", "reasons", "limitations", "recommendedNextAction", "createdAt"];
  if (Object.keys(gateResult).some(field => !fields.includes(field)) || fields.some(field => !(field in gateResult))) throw new Error("Execution Gate Result is schema-invalid.");
  const patterns = { gateResultId:/^gate_result_[A-Za-z0-9][A-Za-z0-9_-]*$/, schemaVersion:/^[0-9]+\.[0-9]+\.[0-9]+$/, requestRef:/^request_[A-Za-z0-9][A-Za-z0-9_-]*$/, planRef:/^plan_[A-Za-z0-9][A-Za-z0-9_-]*$/, toolRequestRef:/^tool_request_[A-Za-z0-9][A-Za-z0-9_-]*$/ };
  for (const [field, pattern] of Object.entries(patterns)) if (typeof gateResult[field] !== "string" || !pattern.test(gateResult[field])) throw new Error("Execution Gate Result is schema-invalid.");
  for (const field of ["policyEvaluationRefs", "riskAssessmentRefs", "approvalRequestRefs", "evidenceRefs", "auditRefs", "protectedActions", "requiredConditions", "unmetConditions", "reasons", "limitations"]) if (!Array.isArray(gateResult[field]) || gateResult[field].some(value => typeof value !== "string")) throw new Error("Execution Gate Result is schema-invalid.");
  if (!["evaluated", "blocked", "waiting", "unverified", "no_action"].includes(gateResult.status) || !["allow_read_only", "waiting_for_policy", "waiting_for_approval", "blocked", "no_action", "unverified"].includes(gateResult.decision) || !["no_action", "gather_more_evidence", "request_policy_evaluation", "request_human_approval", "block_request"].includes(gateResult.recommendedNextAction) || Number.isNaN(Date.parse(gateResult.createdAt))) throw new Error("Execution Gate Result is schema-invalid.");
  if (gateResult.toolRequestRef !== request.toolRequestId || gateResult.requestRef !== request.requestRef || gateResult.planRef !== request.planRef) throw new Error("Execution Gate Result does not reference the same Tool Request.");
  if (gateResult.decision !== "allow_read_only" || gateResult.status !== "evaluated" || gateResult.recommendedNextAction !== "no_action") throw new Error("Execution Gate Result does not authorize read-only invocation.");
  const evidenceIds = request.evidenceRefs.map(value => typeof value === "string" ? value : value?.evidenceId).filter(Boolean);
  const verifiedEvidenceIds = request.evidenceRefs.filter(value => value?.verificationStatus === "verified").map(value => value.evidenceId);
  if (request.status !== "ready" || !gateResult.evidenceRefs.length || gateResult.evidenceRefs.some(ref => !evidenceIds.includes(ref) || !verifiedEvidenceIds.includes(ref)) || gateResult.unmetConditions.length || gateResult.protectedActions.length) throw new Error("Execution Gate Result contains contradictory or insufficient evidence.");
  if (JSON.stringify(gateResult.policyEvaluationRefs) !== JSON.stringify(request.policyEvaluationRefs) || JSON.stringify(gateResult.approvalRequestRefs) !== JSON.stringify(request.approvalRequestRefs)) throw new Error("Execution Gate Result authorization references contradict the Tool Request.");
}

export async function invokeReadOnlyTool(registry, request, gateResult) {
  const startedAt = now();
  const base = { toolResultId: id("tool_result", request?.toolRequestId), schemaVersion: "1.0.0", toolRequestRef: request?.toolRequestId ?? "tool_request_unverified", toolId: request?.toolId ?? "unverified.tool", operation: request?.requestedOperation ?? "inspect", startedAt, completedAt: now(), durationMs: 0, output: {}, warnings: [], errors: [], limitations: ["Read-only Tool Orchestrator executes only explicit registered in-process handlers."], evidenceRefs: request?.evidenceRefs ?? [], auditRefs: request?.auditRefs ?? [], sideEffectsObserved: [], recommendedNextAction: "block_request" };
  try {
    validateToolRequest(request);
    validateExecutionGateResult(gateResult, request);
    const entry = registry.resolve(request.toolId);
    if (!entry) throw new Error("Unknown tool is denied.");
    const { descriptor, handler } = entry;
    if (!descriptor.enabled) throw new Error("Disabled tool is denied.");
    if (!descriptor.supported) throw new Error("Unsupported tool is denied.");
    if (!["none", "read_only"].includes(descriptor.sideEffectClass)) throw new Error("Tool side-effect class is denied.");
    if (descriptor.networkRequired || descriptor.requiresHumanApproval || descriptor.requiresPolicyEvaluation || descriptor.sandboxRequired) throw new Error("Tool requires unavailable authority or environment.");
    if (descriptor.operationType !== request.requestedOperation) throw new Error("Requested operation does not match registered tool.");
    let timeoutId;
    const output = await Promise.race([
      handler(request),
      new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error("Tool invocation timed out.")), request.timeoutMs); })
    ]);
    clearTimeout(timeoutId);
    return { ...base, toolId: descriptor.toolId, operation: descriptor.operationType, completedAt: now(), output, status: "succeeded", recommendedNextAction: "review_result" };
  } catch (error) {
    const timedOut = error.message === "Tool invocation timed out.";
    const denied = /denied|unavailable authority|side-effect|Unknown tool|Disabled tool|Unsupported tool|escapes|Sensitive|Ignored|must be|Execution Gate|authoriz|contradictory|same Tool Request|invalid/.test(error.message);
    return { ...base, completedAt: now(), status: timedOut ? "timed_out" : denied ? "denied" : "failed", errors: [message(timedOut ? "tool_timeout" : denied ? "tool_access_denied" : "tool_handler_failed", error.message)], recommendedNextAction: denied ? "block_request" : "gather_more_evidence" };
  }
}
