import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evaluateSandboxPreparationGate } from "../src/gates/execution-gate.mjs";
import { editSandbox } from "../src/sandbox/sandbox-file-editor.mjs";
import { cleanupSecureSandbox, createSecureSandbox } from "../src/sandbox/secure-sandbox-manager.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const source=await mkdtemp(path.join(os.tmpdir(),"kaveep-editor-source-")); let manifestPath;
const timestamp="1970-01-01T00:00:00.000Z";
const evidence={evidenceId:"evidence_editor_test_001",evidenceType:"sandbox_request",verificationStatus:"verified",sourceType:"system_observation",createdAt:timestamp,summary:"Editor test."};
const request={sandboxRequestId:"sandbox_request_editor_001",schemaVersion:"1.0.0",requestRef:"request_editor_001",planRef:"plan_editor_001",contextRef:"context_editor_001",gateResultRef:"gate_result_sandbox_editor_001",sourceRepositoryRoot:source,requestedWorkspaceMode:"bounded_repository_copy",selectedPaths:[],excludedPaths:[],resourceLimits:{maxFiles:100,maxDirectories:50,maxTotalBytes:1048576,maxSingleFileBytes:65536,maxDepth:8,maxPathLength:512,maxLifetimeSeconds:3600},preserveOriginalState:true,cleanupPolicy:"explicit",evidenceRefs:[evidence],auditRefs:[],status:"proposed",createdAt:timestamp};
const plan={planId:"plan_editor_001",requestId:"request_editor_001",status:"proposed",safety:{planAuthorizesExecution:false,protectedActions:[]}};
const schemaValidate=async(value,name)=>{const schemaPath=path.resolve("schemas",name);const errors=[];await validateValue(value,await loadSchema(schemaPath),{schemaPath,rootSchema:await loadSchema(schemaPath)},"$",errors);assert.deepEqual(errors,[]);};
try {
  await writeFile(path.join(source,"base.txt"),"alpha"); await mkdir(path.join(source,"folder")); await writeFile(path.join(source,"folder","delete.txt"),"remove");
  const sourceBefore=await readFile(path.join(source,"base.txt"),"utf8");
  const created=await createSecureSandbox(request,evaluateSandboxPreparationGate(plan,request)); manifestPath=created.result.manifestRef; assert.equal(created.result.status,"ready");
  const result=await editSandbox(manifestPath,[
    {operation:"create",path:"new.txt",text:"one"},{operation:"overwrite",path:"base.txt",text:"beta"},{operation:"append",path:"base.txt",text:"!"},
    {operation:"replace",path:"base.txt",search:"beta",text:"gamma"},{operation:"rename",path:"new.txt",destination:"renamed.txt"},{operation:"delete",path:"folder/delete.txt"}
  ],{timestamp});
  assert.equal(await readFile(path.join(created.result.sandboxRoot,"base.txt"),"utf8"),"gamma!");
  assert.equal(await readFile(path.join(created.result.sandboxRoot,"renamed.txt"),"utf8"),"one");
  assert.equal(await readFile(path.join(source,"base.txt"),"utf8"),sourceBefore);
  assert.equal(result.changeSet.rollbackReady,true); assert.equal(result.changeSet.changes.length,6); assert.equal(result.sourceRepositoryModified,false);
  assert.deepEqual(result.diff.filesAdded,["renamed.txt"]); assert.deepEqual(result.diff.filesModified,["base.txt"]); assert.deepEqual(result.diff.filesDeleted,["folder/delete.txt"]);
  await schemaValidate(result.changeSet,"sandbox-change.schema.json"); await schemaValidate(result.diff,"sandbox-diff.schema.json"); await schemaValidate(result,"sandbox-edit-result.schema.json");
  await assert.rejects(editSandbox(manifestPath,[{operation:"create",path:"../escape.txt",text:"x"}],{timestamp}));
  await assert.rejects(editSandbox(manifestPath,[{operation:"create",path:path.join(source,"escape.txt"),text:"x"}],{timestamp}));
  await assert.rejects(editSandbox(path.join(source,"sandbox-manifest.json"),[{operation:"create",path:"x",text:"x"}],{timestamp}));
  try { await symlink(source,path.join(created.result.sandboxRoot,"link"),"junction"); await assert.rejects(editSandbox(manifestPath,[{operation:"create",path:"link/escape.txt",text:"x"}],{timestamp})); } catch (error) { if (!/[Pp]rivilege|operation not permitted|EPERM/.test(error.message)) throw error; }
  const repeat=await editSandbox(manifestPath,[{operation:"overwrite",path:"base.txt",text:"gamma!"}],{timestamp});
  const repeat2=await editSandbox(manifestPath,[{operation:"overwrite",path:"base.txt",text:"gamma!"}],{timestamp});
  assert.deepEqual(repeat.diff,repeat2.diff); assert.equal(await readFile(path.join(source,"base.txt"),"utf8"),sourceBefore);
  console.log("PASSED sandbox file editor tests; deterministic diff; source unchanged");
} finally { if(manifestPath) try{await cleanupSecureSandbox(manifestPath);}catch{} await rm(source,{recursive:true,force:true}); }
