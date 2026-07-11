import path from "node:path";
import { evaluateSandboxPreparationGate } from "../src/gates/execution-gate.mjs";
import { createSecureSandbox } from "../src/sandbox/secure-sandbox-manager.mjs";

const sourceRepositoryRoot = process.argv[2];
const evidence = { evidenceId:"evidence_sandbox_cli_001", evidenceType:"sandbox_request", verificationStatus:"verified", sourceType:"human_input", createdAt:new Date(0).toISOString(), summary:"Explicit CLI sandbox preparation request." };
const request = { sandboxRequestId:"sandbox_request_cli_001", schemaVersion:"1.0.0", requestRef:"request_sandbox_cli_001", planRef:"plan_sandbox_cli_001", contextRef:"context_sandbox_cli_001", gateResultRef:"gate_result_sandbox_cli_001", sourceRepositoryRoot, requestedWorkspaceMode:"bounded_repository_copy", selectedPaths:[], excludedPaths:[], resourceLimits:{ maxFiles:1000, maxDirectories:300, maxTotalBytes:52428800, maxSingleFileBytes:5242880, maxDepth:12, maxPathLength:1024, maxLifetimeSeconds:3600 }, preserveOriginalState:true, cleanupPolicy:"explicit", evidenceRefs:[evidence], auditRefs:[], status:"proposed", createdAt:new Date(0).toISOString() };
const plan = { planId:request.planRef, requestId:request.requestRef, status:"proposed", safety:{ planAuthorizesExecution:false, protectedActions:[] } };
const gateResult = evaluateSandboxPreparationGate(plan, request);
const output = await createSecureSandbox(request, gateResult);
process.stdout.write(JSON.stringify({ request:{ ...request, sourceRepositoryRoot:sourceRepositoryRoot ? path.resolve(sourceRepositoryRoot) : sourceRepositoryRoot }, gateResult, ...output }, null, 2) + "\n");
if (!output.result.status.startsWith("ready")) process.exitCode = 1;
