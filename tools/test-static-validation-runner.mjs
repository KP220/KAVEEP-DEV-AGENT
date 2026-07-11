import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evaluateSandboxPreparationGate } from "../src/gates/execution-gate.mjs";
import { cleanupSecureSandbox, createSecureSandbox } from "../src/sandbox/secure-sandbox-manager.mjs";
import { runStaticValidation } from "../src/execution/static-validation-runner.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const source = await mkdtemp(path.join(os.tmpdir(), "kaveep-static-source-"));
let manifestPath;
const evidence = { evidenceId:"evidence_static_001", evidenceType:"sandbox_request", verificationStatus:"verified", sourceType:"system_observation", createdAt:"1970-01-01T00:00:00.000Z", summary:"Static validation test." };
const request = { sandboxRequestId:"sandbox_request_static_001", schemaVersion:"1.0.0", requestRef:"request_static_001", planRef:"plan_static_001", contextRef:"context_static_001", gateResultRef:"gate_result_sandbox_static_001", sourceRepositoryRoot:source, requestedWorkspaceMode:"bounded_repository_copy", selectedPaths:[], excludedPaths:[], resourceLimits:{maxFiles:100,maxDirectories:50,maxTotalBytes:1048576,maxSingleFileBytes:65536,maxDepth:8,maxPathLength:512,maxLifetimeSeconds:3600}, preserveOriginalState:true, cleanupPolicy:"explicit", evidenceRefs:[evidence], auditRefs:[], status:"proposed", createdAt:"1970-01-01T00:00:00.000Z" };
const plan = { planId:"plan_static_001", requestId:"request_static_001", status:"proposed", safety:{planAuthorizesExecution:false,protectedActions:[]} };

async function valid(value, name) {
  const schemaPath=path.resolve("schemas",name), schema=await loadSchema(schemaPath), errors=[];
  await validateValue(value,schema,{schemaPath,rootSchema:schema},"$",errors);
  assert.deepEqual(errors,[]);
}

try {
  await mkdir(path.join(source,"src"));
  await writeFile(path.join(source,"src","good.mjs"),"export const value = 1;\n");
  await writeFile(path.join(source,"src","bad.mjs"),"export const = ;\n");
  await writeFile(path.join(source,"src","side-effect.mjs"),"import{writeFileSync}from'node:fs';writeFileSync('EXECUTED','yes');\n");
  const before=await readFile(path.join(source,"src","good.mjs"),"utf8");
  const created=await createSecureSandbox(request,evaluateSandboxPreparationGate(plan,request));
  assert(created.manifest,JSON.stringify(created.result.errors));
  manifestPath=created.result.manifestRef;
  const make=(files,extra={})=>({validationRequestId:"static_validation_request_test_001",schemaVersion:"1.0.0",sandboxId:created.manifest.sandboxId,manifestRef:manifestPath,operation:"node_syntax_check",files,limits:{maxFiles:10,timeoutMsPerFile:5000,maxOutputBytes:65536},status:"proposed",createdAt:"1970-01-01T00:00:00.000Z",...extra});
  const passed=await runStaticValidation(make(["src/good.mjs","src/side-effect.mjs"]));
  await valid(passed,"static-validation-result.schema.json");
  assert.equal(passed.status,"passed");
  await assert.rejects(readFile(path.join(created.result.sandboxRoot,"src","EXECUTED")));
  const failed=await runStaticValidation(make(["src/bad.mjs"]));
  assert.equal(failed.status,"failed");
  assert(failed.fileResults[0].stderr.length>0);
  assert.equal((await runStaticValidation(make(["../outside.mjs"]))).status,"blocked");
  assert.equal((await runStaticValidation(make(["package.json"]))).status,"blocked");
  assert.equal((await runStaticValidation(make(["src/good.mjs"],{sandboxId:"sandbox_wrong"}))).status,"blocked");
  try { await symlink(path.join(source,"src","good.mjs"),path.join(created.result.sandboxRoot,"src","link.mjs")); assert.equal((await runStaticValidation(make(["src/link.mjs"]))).status,"blocked"); } catch {}
  assert.equal(await readFile(path.join(source,"src","good.mjs"),"utf8"),before);
  console.log("PASSED sandbox static validation tests; parser executed; repository modules and source writes not executed");
} finally {
  if(manifestPath) try { await cleanupSecureSandbox(manifestPath); } catch {}
  await rm(source,{recursive:true,force:true});
}
