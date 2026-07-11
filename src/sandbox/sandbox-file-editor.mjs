import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { isInsideRoot, normalizeRelative } from "../repository/repository-intelligence.mjs";
import { detectSandboxChanges } from "./sandbox-change-detector.mjs";
import { verifySecureSandbox } from "./secure-sandbox-manager.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");
const emptyHash = hash(Buffer.alloc(0));
const internalNames = new Set([".kaveep-sandbox.json","sandbox-manifest.json",".kaveep-changes"]);
const limitations = ["Edits are sandbox-only; no source write-back is available.","Diff is a deterministic file summary, not a line diff or Git diff.","Build, test, process, shell, network, Git, and deployment operations are unavailable."];

function safeRelative(value) {
  if (typeof value !== "string" || !value.trim() || path.isAbsolute(value)) throw new Error("A non-empty sandbox-relative path is required.");
  const relative = normalizeRelative(value).replace(/^\.\//, "");
  if (!relative || relative === "." || relative.split("/").some(part => part === "..") || internalNames.has(relative.split("/")[0])) throw new Error("Traversal or internal sandbox path is denied.");
  return relative;
}

async function resolveTarget(root, input, allowMissing = false) {
  const relative = safeRelative(input); const absolute = path.resolve(root, relative);
  if (!isInsideRoot(root, absolute)) throw new Error("Path escaped the sandbox root.");
  let cursor = path.dirname(absolute);
  while (isInsideRoot(root, cursor) && cursor !== root) {
    try { const info=await lstat(cursor); if (info.isSymbolicLink()) throw new Error("Symlink escape is denied."); cursor=path.dirname(cursor); }
    catch (error) { if (error.code === "ENOENT") { cursor=path.dirname(cursor); continue; } throw error; }
  }
  try {
    const info=await lstat(absolute); if (info.isSymbolicLink()) throw new Error("Symlink targets are denied.");
    const canonical=await realpath(absolute); if (!isInsideRoot(root, canonical)) throw new Error("Canonical path escaped the sandbox root.");
    return { relative, absolute, exists:true, info };
  } catch (error) { if (allowMissing && error.code === "ENOENT") return { relative, absolute, exists:false }; throw error; }
}

const bufferOf = value => Buffer.from(String(value ?? ""), "utf8");
const evidenceId = (sandboxId, index) => `evidence_${sandboxId.replace(/^sandbox_/, "sandbox_edit_")}_${String(index + 1).padStart(3,"0")}`;

export async function editSandbox(manifestPath, operations, options = {}) {
  const { manifest, root } = await verifySecureSandbox(manifestPath);
  if (!Array.isArray(operations) || operations.length === 0) throw new Error("At least one explicit edit operation is required.");
  const timestamp = options.timestamp ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(timestamp))) throw new Error("A valid edit timestamp is required.");
  const changes=[]; const warnings=[]; const evidence=[];
  for (let index=0; index<operations.length; index++) {
    const operation=operations[index]; const kind=operation?.operation; const target=await resolveTarget(root, operation?.path, kind === "create");
    let before=Buffer.alloc(0), after=Buffer.alloc(0), resultingPath=target.relative;
    if (target.exists) { if (!target.info.isFile()) throw new Error("Edit target must be a regular file."); before=await readFile(target.absolute); }
    if (kind === "create") { if (target.exists) throw new Error("Create target already exists."); after=bufferOf(operation.text); await mkdir(path.dirname(target.absolute),{recursive:true}); await writeFile(target.absolute,after,{flag:"wx"}); }
    else if (kind === "overwrite") { if (!target.exists) throw new Error("Overwrite target does not exist."); after=bufferOf(operation.text); await writeFile(target.absolute,after); }
    else if (kind === "append") { if (!target.exists) throw new Error("Append target does not exist."); const addition=bufferOf(operation.text); after=Buffer.concat([before,addition]); await appendFile(target.absolute,addition); }
    else if (kind === "replace") { if (!target.exists || typeof operation.search !== "string" || !operation.search.length) throw new Error("Replace requires an existing file and non-empty search text."); const source=before.toString("utf8"); const occurrences=source.split(operation.search).length-1; if (!occurrences) throw new Error("Replace search text was not found."); if (operation.replaceAll === false && occurrences !== 1) throw new Error("Non-global replace requires exactly one match."); const replacement=String(operation.text ?? ""); after=bufferOf(operation.replaceAll === false ? source.replace(operation.search,replacement) : source.split(operation.search).join(replacement)); await writeFile(target.absolute,after); }
    else if (kind === "rename") { if (!target.exists) throw new Error("Rename source does not exist."); const destination=await resolveTarget(root,operation.destination,true); if (destination.exists) throw new Error("Rename destination already exists."); await mkdir(path.dirname(destination.absolute),{recursive:true}); await rename(target.absolute,destination.absolute); after=before; resultingPath=destination.relative; }
    else if (kind === "delete") { if (!target.exists) throw new Error("Delete target does not exist."); await rm(target.absolute); }
    else throw new Error("Unsupported sandbox edit operation.");
    const ref=evidenceId(manifest.sandboxId,index);
    evidence.push({ evidenceId:ref, evidenceType:"sandbox_file_edit", verificationStatus:"verified", sourceType:"system_observation", createdAt:timestamp, summary:`${kind} ${target.relative}${kind === "rename" ? ` -> ${resultingPath}` : ""}` });
    changes.push({ sequence:index+1, operation:kind, relativePath:target.relative, resultingPath, beforeHash:before.length ? hash(before) : emptyHash, afterHash:after.length ? hash(after) : emptyHash, beforeBytes:before.length, afterBytes:after.length, timestamp, evidenceRef:ref, rollback:{ operation:kind === "create" ? "delete" : kind === "rename" ? "rename" : kind === "delete" ? "create" : "overwrite", path:resultingPath, ...(kind === "rename" ? { destination:target.relative } : {}), ...(["delete","overwrite","append","replace"].includes(kind) ? { contentBase64:before.toString("base64") } : {}) } });
  }
  const detected=await detectSandboxChanges(manifest);
  const diff={ sandboxId:manifest.sandboxId, filesAdded:detected.addedFiles, filesModified:detected.modifiedFiles, filesDeleted:detected.deletedFiles, bytesChanged:changes.reduce((sum,item)=>sum+Math.abs(item.afterBytes-item.beforeBytes),0), warnings:[...warnings,...detected.warnings], limitations };
  const changeSet={ changeSetId:`change_set_${manifest.sandboxId.replace(/^sandbox_/,"")}`, schemaVersion:"1.0.0", sandboxId:manifest.sandboxId, createdAt:timestamp, changes, evidenceRefs:evidence, warnings, rollbackReady:true, sourceRepositoryModified:false };
  const result={ sandboxEditResultId:`sandbox_edit_result_${manifest.sandboxId.replace(/^sandbox_/,"")}`, schemaVersion:"1.0.0", sandboxId:manifest.sandboxId, status:warnings.length ? "completed_with_warnings" : "completed", startedAt:timestamp, completedAt:timestamp, changeSet, diff, warnings, errors:[], limitations, sourceRepositoryModified:false, recommendedNextAction:"validate_changes" };
  const evidenceRoot=path.join(root,".kaveep-changes"); await mkdir(evidenceRoot,{recursive:true});
  await writeFile(path.join(evidenceRoot,`${changeSet.changeSetId}.json`),JSON.stringify(result,null,2));
  return result;
}
