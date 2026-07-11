import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ToolRegistry } from "../src/tools/tool-registry.mjs";
import { builtInTools, invokeReadOnlyTool, registerBuiltInTools } from "../src/tools/tool-orchestrator.mjs";
import { evaluateExecutionGate } from "../src/gates/execution-gate.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "kaveep-tool-test-"));
const evidence = { evidenceId:"evidence_test_001", evidenceType:"tool_request", verificationStatus:"verified", sourceType:"report", createdAt:"1970-01-01T00:00:00.000Z", summary:"Verified test request." };
const makeRequest = (overrides = {}) => ({ toolRequestId:"tool_request_test_001", schemaVersion:"1.0.0", toolId:"file.stat", toolVersion:"1.0.0", requestRef:"request_test_001", planRef:"plan_test_001", contextRef:"context_test_001", repositoryIntelligenceRef:"repo_intel_test_001", requestedOperation:"inspect", arguments:{ path:"safe.md" }, approvedRoot:tempRoot, expectedOutput:"metadata", timeoutMs:5000, policyEvaluationRefs:[], approvalRequestRefs:[], evidenceRefs:[evidence], auditRefs:[], status:"ready", createdAt:"1970-01-01T00:00:00.000Z", ...overrides });
const plan = { planId:"plan_test_001", requestId:"request_test_001", status:"proposed", safety:{ planAuthorizesExecution:false, protectedActions:[] } };
const makeGate = (request, overrides = {}) => ({ ...evaluateExecutionGate(plan, request), ...overrides });

try {
  await writeFile(path.join(tempRoot, "safe.md"), "safe text\nneedle\n");
  const registry = registerBuiltInTools(new ToolRegistry());
  let invocations = 0;
  const counted = new ToolRegistry();
  counted.register(builtInTools[1].descriptor, async request => { invocations++; return builtInTools[1].handler(request); });
  const request = makeRequest();
  const valid = await invokeReadOnlyTool(counted, request, makeGate(request));
  assert.equal(valid.status, "succeeded");
  assert.equal(invocations, 1);

  const deniedCases = [
    undefined,
    {},
    makeGate(request, { toolRequestRef:"tool_request_other_001" }),
    makeGate(request, { decision:"waiting_for_policy", status:"waiting", recommendedNextAction:"request_policy_evaluation" }),
    makeGate(request, { decision:"waiting_for_approval", status:"waiting", recommendedNextAction:"request_human_approval" }),
    makeGate(request, { decision:"blocked", status:"blocked", recommendedNextAction:"block_request" }),
    makeGate(request, { decision:"no_action", status:"no_action" }),
    makeGate(request, { decision:"unverified", status:"unverified", recommendedNextAction:"gather_more_evidence" }),
    makeGate(request, { unmetConditions:["missing evidence"] }),
    makeGate(request, { evidenceRefs:[] })
  ];
  for (const gate of deniedCases) assert.equal((await invokeReadOnlyTool(counted, request, gate)).status, "denied");
  assert.equal(invocations, 1, "denied gate paths must never invoke the handler");

  const unknownRequest = makeRequest({ toolId:"unknown.tool" });
  assert.equal((await invokeReadOnlyTool(registry, unknownRequest, makeGate(unknownRequest))).status, "denied");
  const disabled = new ToolRegistry(); disabled.register({ ...builtInTools[1].descriptor, enabled:false }, async () => { invocations++; });
  assert.equal((await invokeReadOnlyTool(disabled, request, makeGate(request))).status, "denied");
  const writer = new ToolRegistry(); writer.register({ ...builtInTools[1].descriptor, toolId:"file.write", sideEffectClass:"workspace_write" }, async () => { invocations++; });
  const writeRequest = makeRequest({ toolId:"file.write" });
  assert.equal((await invokeReadOnlyTool(writer, writeRequest, makeGate(writeRequest, { decision:"allow_read_only", status:"evaluated", recommendedNextAction:"no_action" }))).status, "denied");
  assert.equal(invocations, 1, "registry denial paths must never invoke handlers");

  const selfAuthorizing = makeRequest({ executionAllowed:true });
  assert.equal((await invokeReadOnlyTool(registry, selfAuthorizing, makeGate(selfAuthorizing))).status, "denied");
  const invalidRequest = makeRequest({ timeoutMs:0 });
  assert.equal((await invokeReadOnlyTool(registry, invalidRequest, makeGate(invalidRequest))).status, "denied");

  const schemaPath = path.resolve("schemas/tool-result.schema.json");
  const schema = await loadSchema(schemaPath); const errors = [];
  await validateValue({ ...valid, status:"executed" }, schema, { schemaPath, rootSchema:schema }, "$", errors);
  assert(errors.length > 0);
  console.log("PASSED tool orchestrator gate enforcement tests; denied handlers invoked: 0");
} finally { await rm(tempRoot, { recursive:true, force:true }); }
