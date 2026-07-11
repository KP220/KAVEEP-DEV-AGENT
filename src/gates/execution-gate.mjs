const now = () => new Date(0).toISOString();
const protectedToolIds = new Set(["file.write","file.delete","file.move","file.rename","shell.execute","git.commit","git.push","git.merge","network.fetch","deploy","publish"]);
const safeToolIds = new Set(["repository.metadata","file.stat","file.read_text","file.search_text"]);
const id = (value) => "gate_result_" + String(value).replace(/^tool_request_/,"").replace(/[^A-Za-z0-9_-]/g,"_");
export function evaluateExecutionGate(plan, toolRequest, references = {}) {
  if (!plan || !toolRequest) throw new Error("Engineering Plan and Tool Request are required.");
  const protectedActions = [...new Set([...(plan.safety?.protectedActions ?? []), ...(references.protectedActions ?? [])])].sort();
  const base = { gateResultId:id(toolRequest.toolRequestId),schemaVersion:"1.0.0",requestRef:plan.requestId,planRef:plan.planId,toolRequestRef:toolRequest.toolRequestId,policyEvaluationRefs:toolRequest.policyEvaluationRefs ?? [],riskAssessmentRefs:references.riskAssessmentRefs ?? [],approvalRequestRefs:toolRequest.approvalRequestRefs ?? [],evidenceRefs:(toolRequest.evidenceRefs ?? []).map(x=>typeof x==="string"?x:x.evidenceId),auditRefs:(toolRequest.auditRefs ?? []).map(x=>typeof x==="string"?x:x.auditId),protectedActions,requiredConditions:[],unmetConditions:[],reasons:[],limitations:["Consumes POLICY and approval references only; it creates no decision or approval.","Execution Gate does not invoke tools or create a sandbox."],createdAt:now() };
  const done=(decision,status,next)=>({...base,decision,status,recommendedNextAction:next});
  if (plan.status==="no_action") return done("no_action","no_action","no_action");
  if (plan.safety?.planAuthorizesExecution===true) return {...done("blocked","blocked","block_request"),reasons:["Engineering Plan cannot authorize itself."],unmetConditions:["non-authorizing plan"]};
  if ((references.policyEvaluations ?? []).some(x=>x.status==="denied")) return {...done("blocked","blocked","block_request"),reasons:["Referenced POLICY evaluation is denied."],unmetConditions:["policy permits operation"]};
  const unsafe=protectedActions.length>0 || protectedToolIds.has(toolRequest.toolId) || !safeToolIds.has(toolRequest.toolId) || !["inspect","read","search"].includes(toolRequest.requestedOperation);
  if (unsafe && !(toolRequest.policyEvaluationRefs ?? []).length) return {...done("waiting_for_policy","waiting","request_policy_evaluation"),requiredConditions:["POLICY evaluation reference"],unmetConditions:["POLICY evaluation reference"],reasons:["Protected or unknown operation requires POLICY evidence."]};
  if (unsafe && !(toolRequest.approvalRequestRefs ?? []).length) return {...done("waiting_for_approval","waiting","request_human_approval"),requiredConditions:["human approval reference"],unmetConditions:["human approval reference"],reasons:["Protected operation lacks an approval reference."]};
  if (unsafe) return {...done("blocked","blocked","block_request"),reasons:["Execution Gate allows only explicitly safe read-only operations."]};
  if (!(toolRequest.evidenceRefs ?? []).length) return {...done("unverified","unverified","gather_more_evidence"),requiredConditions:["evidence reference"],unmetConditions:["evidence reference"],reasons:["Safe read-only operation lacks evidence reference."]};
  return {...done("allow_read_only","evaluated","no_action"),requiredConditions:["safe registered read-only operation","evidence reference"],reasons:["Read-only operation is eligible only for future controlled invocation."]};
}

export function evaluateSandboxPreparationGate(plan, sandboxRequest) {
  if (!plan || !sandboxRequest) throw new Error("Engineering Plan and Sandbox Request are required.");
  const evidenceRefs = (sandboxRequest.evidenceRefs ?? []).map(value => typeof value === "string" ? value : value.evidenceId).filter(Boolean);
  const base = {
    gateResultId: `gate_result_${String(sandboxRequest.sandboxRequestId).replace(/^sandbox_request_/, "sandbox_").replace(/[^A-Za-z0-9_-]/g, "_")}`,
    schemaVersion: "1.0.0", requestRef: plan.requestId, planRef: plan.planId,
    toolRequestRef: `tool_request_${String(sandboxRequest.sandboxRequestId).replace(/^sandbox_request_/, "sandbox_")}`,
    sandboxRequestRef: sandboxRequest.sandboxRequestId, policyEvaluationRefs: [], riskAssessmentRefs: [], approvalRequestRefs: [],
    evidenceRefs, auditRefs: (sandboxRequest.auditRefs ?? []).map(value => typeof value === "string" ? value : value.auditId).filter(Boolean),
    protectedActions: [], requiredConditions: ["explicit sandbox request", "isolated temporary destination", "verified evidence"], unmetConditions: [],
    reasons: ["Isolated bounded copying may prepare a sandbox without modifying the source repository."],
    limitations: ["Sandbox preparation authorizes no engineering write, process execution, or external write-back."],
    createdAt: now()
  };
  if (plan.safety?.planAuthorizesExecution === true) return { ...base, status:"blocked", decision:"blocked", unmetConditions:["non-authorizing plan"], recommendedNextAction:"block_request" };
  if (!evidenceRefs.length) return { ...base, status:"unverified", decision:"unverified", unmetConditions:["verified evidence"], recommendedNextAction:"gather_more_evidence" };
  return { ...base, status:"evaluated", decision:"allow_sandbox_preparation", recommendedNextAction:"no_action" };
}
