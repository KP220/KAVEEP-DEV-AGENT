import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { runEngineeringBrain } from "../brain/engineering-brain.mjs";
import { isInsideRoot, normalizeRelative } from "../repository/repository-intelligence.mjs";
import { editSandbox } from "../sandbox/sandbox-file-editor.mjs";
import { verifySecureSandbox } from "../sandbox/secure-sandbox-manager.mjs";
import { runStaticValidation } from "../execution/static-validation-runner.mjs";

const limitations=["The loop performs Node.js syntax validation only; it does not run builds or tests.","All edits remain inside one verified sandbox; no source write-back, Git, release, or deployment is available.","A passed loop is reviewable evidence, not approval."];
const hash=value=>createHash("sha256").update(value).digest("hex");
const throwIfAborted=signal=>{if(signal?.aborted)throw new Error("Session cancelled.");};
function validateRequest(r){if(!r||r.status!=="proposed"||!r.loopRequestId||!r.sandboxId||!r.manifestRef||!r.brainRequest||!Number.isInteger(r.maxAttempts)||r.maxAttempts<1||r.maxAttempts>5)throw new Error("Engineering Loop Request is invalid.");}
async function readContextFile(root,value){if(typeof value!=="string"||path.isAbsolute(value))throw new Error("Loop context path must be sandbox-relative.");const relative=normalizeRelative(value).replace(/^\.\//,"");if(relative.split("/").includes(".."))throw new Error("Loop context path escaped sandbox.");const absolute=path.resolve(root,relative);if(!isInsideRoot(root,absolute))throw new Error("Loop context path escaped sandbox.");const info=await lstat(absolute);if(info.isSymbolicLink()||!info.isFile())throw new Error("Loop context target must be a regular non-link file.");const canonical=await realpath(absolute);if(!isInsideRoot(root,canonical))throw new Error("Loop context canonical path escaped sandbox.");const content=await readFile(canonical,"utf8");return{path:relative,content,sha256:hash(content)};}

export async function runIterativeEngineeringLoop(request,registry,options={}){
  const startedAt=(options.clock?.()??new Date()).toISOString();const suffix=String(request?.loopRequestId??"blocked").replace(/^engineering_loop_request_/,"");const base={loopResultId:`engineering_loop_result_${suffix}`,schemaVersion:"1.0.0",loopRequestRef:request?.loopRequestId??"engineering_loop_request_blocked",sandboxId:request?.sandboxId??"sandbox_blocked",status:"blocked",attempts:[],attemptsUsed:0,maxAttempts:request?.maxAttempts??1,finalProposal:null,finalDiff:null,warnings:[],errors:[],limitations,sourceRepositoryModified:false,startedAt,completedAt:startedAt,recommendedNextAction:"block_request"};
  try{throwIfAborted(options.signal);validateRequest(request);const verified=await verifySecureSandbox(request.manifestRef);throwIfAborted(options.signal);if(verified.manifest.sandboxId!==request.sandboxId)throw new Error("Loop sandbox identity mismatch.");let brainRequest=structuredClone(request.brainRequest);let feedback="";let contextPaths=new Set(brainRequest.contextFiles.map(x=>x.path));
    for(let attempt=1;attempt<=request.maxAttempts;attempt++){throwIfAborted(options.signal);
      const refreshed=[];for(const p of [...contextPaths].sort())try{refreshed.push(await readContextFile(verified.root,p));}catch(error){if(error.code!=="ENOENT")throw error;}
      brainRequest={...brainRequest,brainRequestId:`brain_request_${suffix}_attempt_${attempt}`,objective:feedback?`${request.brainRequest.objective}\n\nPrevious static validation failed. Correct the proposal using this untrusted validation evidence:\n${feedback}`:request.brainRequest.objective,contextFiles:refreshed};
      const brainResult=await runEngineeringBrain(brainRequest,registry,{clock:options.clock,proposalSchema:options.proposalSchema,signal:options.signal});throwIfAborted(options.signal);
      const record={attempt,brainResult,editResult:null,validationResult:null,outcome:"brain_failed"};base.attempts.push(record);base.attemptsUsed=attempt;
      if(brainResult.status!=="completed"){base.status="failed";base.errors.push(...brainResult.errors);base.recommendedNextAction=brainResult.recommendedNextAction==="gather_more_context"?"gather_more_context":"block_request";break;}
      const proposal=brainResult.proposal;if(!proposal.validationFiles.length)throw new Error("Engineering Proposal requires at least one static validation file.");
      try{record.editResult=await editSandbox(request.manifestRef,proposal.proposedEdits,{timestamp:(options.clock?.()??new Date()).toISOString()});throwIfAborted(options.signal);}catch(error){record.outcome="edit_failed";base.status="failed";base.errors.push(error.message);base.recommendedNextAction="revise_manually";break;}
      for(const p of proposal.validationFiles)contextPaths.add(p);
      record.validationResult=await runStaticValidation({validationRequestId:`static_validation_request_${suffix}_attempt_${attempt}`,schemaVersion:"1.0.0",sandboxId:request.sandboxId,manifestRef:request.manifestRef,operation:"node_syntax_check",files:proposal.validationFiles,limits:{maxFiles:Math.min(100,Math.max(1,proposal.validationFiles.length)),timeoutMsPerFile:options.timeoutMsPerFile??5000,maxOutputBytes:options.maxOutputBytes??65536},status:"proposed",createdAt:(options.clock?.()??new Date()).toISOString()});
      base.finalProposal=proposal;base.finalDiff=record.editResult.diff;
      if(record.validationResult.status==="passed"){record.outcome="passed";base.status="completed";base.recommendedNextAction="review_changes";break;}
      record.outcome="validation_failed";feedback=record.validationResult.fileResults.map(x=>`${x.path}: ${x.stderr||"syntax validation failed"}`).join("\n").slice(0,options.maxFeedbackCharacters??20000);
      if(attempt===request.maxAttempts){base.status="exhausted";base.recommendedNextAction="revise_manually";}
    }
  }catch(error){base.status="failed";base.errors.push(error.message);base.recommendedNextAction=/context|ENOENT/i.test(error.message)?"gather_more_context":"block_request";}
  base.completedAt=(options.clock?.()??new Date()).toISOString();return base;
}
