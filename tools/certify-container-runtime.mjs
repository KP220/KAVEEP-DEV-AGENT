import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runContainerValidation } from "../src/execution/container-validation-runner.mjs";
import { evaluateSandboxPreparationGate } from "../src/gates/execution-gate.mjs";
import { cleanupSecureSandbox, createSecureSandbox } from "../src/sandbox/secure-sandbox-manager.mjs";

const image = process.argv[2]; if (!image) throw new Error("Usage: npm run certify:container -- <preloaded-node-image>");
const source = await mkdtemp(path.join(os.tmpdir(), "kaveep-container-cert-source-")); let manifestRef;
try {
  await mkdir(path.join(source, "src"));
  await writeFile(path.join(source, "package.json"), JSON.stringify({ name: "kaveep-container-certification", scripts: { test: "node src/probe.mjs" } }));
  await writeFile(path.join(source, "src/probe.mjs"), `import { writeFile } from "node:fs/promises"; import net from "node:net";
let writeDenied=false; try { await writeFile("/workspace/escape.txt","forbidden"); } catch { writeDenied=true; }
const networkDenied=await new Promise(resolve=>{const socket=net.connect({host:"1.1.1.1",port:53,timeout:1500});socket.on("connect",()=>{socket.destroy();resolve(false)});socket.on("error",()=>resolve(true));socket.on("timeout",()=>{socket.destroy();resolve(true)});});
if(!writeDenied||!networkDenied){console.error(JSON.stringify({writeDenied,networkDenied}));process.exit(9);}console.log(JSON.stringify({writeDenied,networkDenied}));\n`);
  const createdAt = new Date().toISOString(); const request = { sandboxRequestId: "sandbox_request_live_certification_001", schemaVersion: "1.0.0", requestRef: "request_live_certification_001", planRef: "plan_live_certification_001", contextRef: "context_live_certification_001", gateResultRef: "gate_result_sandbox_live_certification_001", sourceRepositoryRoot: source, requestedWorkspaceMode: "bounded_repository_copy", selectedPaths: [], excludedPaths: [], resourceLimits: { maxFiles: 100, maxDirectories: 50, maxTotalBytes: 1048576, maxSingleFileBytes: 65536, maxDepth: 8, maxPathLength: 512, maxLifetimeSeconds: 600 }, preserveOriginalState: true, cleanupPolicy: "explicit", evidenceRefs: [{ evidenceId: "evidence_live_certification_001", evidenceType: "sandbox_request", verificationStatus: "verified", sourceType: "system_observation", createdAt, summary: "Live container isolation certification." }], auditRefs: [], status: "proposed", createdAt };
  const plan = { planId: request.planRef, requestId: request.requestRef, status: "proposed", safety: { planAuthorizesExecution: false, protectedActions: [] } }; const sandbox = await createSecureSandbox(request, evaluateSandboxPreparationGate(plan, request)); manifestRef = sandbox.result.manifestRef;
  const result = await runContainerValidation({ containerRequestId: "container_validation_request_live_certification_001", schemaVersion: "1.0.0", sandboxId: sandbox.manifest.sandboxId, manifestRef, executionProfile: "node", image, allowedImages: [image], operations: ["test"], limits: { timeoutMsPerOperation: 30000, maxOutputBytes: 65536, memoryMb: 256, cpus: 0.5, pids: 64 }, status: "proposed", createdAt });
  const sourceUnchanged = !await readFile(path.join(source, "escape.txt"), "utf8").then(() => true, () => false);
  const sandboxUnchanged = !await readFile(path.join(sandbox.result.sandboxRoot, "escape.txt"), "utf8").then(() => true, () => false);
  const certified = result.status === "passed" && sourceUnchanged && sandboxUnchanged && result.operationResults[0]?.stdout.includes('"writeDenied":true') && result.operationResults[0]?.stdout.includes('"networkDenied":true');
  const report = { certificationId: "container_certification_live_001", status: certified ? "certified" : result.status === "runtime_unavailable" ? "runtime_unavailable" : "failed", image, sourceUnchanged, sandboxUnchanged, validationResult: result, certifiedAt: new Date().toISOString() };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); if (!certified) process.exitCode = 1;
} finally { if (manifestRef) try { await cleanupSecureSandbox(manifestRef); } catch {} await rm(source, { recursive: true, force: true }); }
