import { createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isIgnoredName, isInsideRoot, isSensitivePath, normalizeRelative, resolveReadOnlyPath } from "../repository/repository-intelligence.mjs";

const markerName = ".kaveep-sandbox.json";
const manifestName = "sandbox-manifest.json";
const now = () => new Date().toISOString();
const msg = (code, message, filePath) => filePath ? { code, message, path:filePath } : { code, message };
const safeId = value => String(value).replace(/^sandbox_request_/, "").replace(/[^A-Za-z0-9_-]/g, "_") || "unknown";
const sha256 = buffer => createHash("sha256").update(buffer).digest("hex");

function validateSandboxRequest(request) {
  const fields = ["sandboxRequestId","schemaVersion","requestRef","planRef","contextRef","gateResultRef","sourceRepositoryRoot","requestedWorkspaceMode","selectedPaths","excludedPaths","resourceLimits","preserveOriginalState","cleanupPolicy","evidenceRefs","auditRefs","status","createdAt"];
  if (!request || typeof request !== "object" || fields.some(field => !(field in request)) || Object.keys(request).some(field => !fields.includes(field))) throw new Error("Sandbox Request is schema-invalid.");
  if (!/^sandbox_request_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(request.sandboxRequestId) || !/^request_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(request.requestRef) || !/^plan_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(request.planRef) || !/^context_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(request.contextRef) || !/^gate_result_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(request.gateResultRef)) throw new Error("Sandbox Request references are schema-invalid.");
  if (!request.sourceRepositoryRoot || !["selected_context_copy","bounded_repository_copy"].includes(request.requestedWorkspaceMode) || !Array.isArray(request.selectedPaths) || !Array.isArray(request.excludedPaths) || request.preserveOriginalState !== true || request.cleanupPolicy !== "explicit" || request.status !== "proposed" || !Array.isArray(request.evidenceRefs) || !Array.isArray(request.auditRefs)) throw new Error("Sandbox Request is schema-invalid.");
  const limits = request.resourceLimits;
  const bounds = { maxFiles:[1,10000], maxDirectories:[1,2000], maxTotalBytes:[1,1073741824], maxSingleFileBytes:[1,104857600], maxDepth:[0,32], maxPathLength:[1,4096], maxLifetimeSeconds:[1,86400] };
  if (!limits || Object.keys(bounds).some(key => !Number.isInteger(limits[key]) || limits[key] < bounds[key][0] || limits[key] > bounds[key][1]) || Object.keys(limits).some(key => !(key in bounds))) throw new Error("Sandbox Request resource limits are schema-invalid.");
}

function validateGate(gate, request) {
  if (!gate || typeof gate !== "object" || gate.gateResultId !== request.gateResultRef || gate.sandboxRequestRef !== request.sandboxRequestId || gate.requestRef !== request.requestRef || gate.planRef !== request.planRef) throw new Error("Execution Gate Result does not exactly correlate to the Sandbox Request.");
  if (gate.decision !== "allow_sandbox_preparation" || gate.status !== "evaluated" || gate.recommendedNextAction !== "no_action" || gate.unmetConditions?.length || gate.protectedActions?.length) throw new Error("Execution Gate Result does not authorize sandbox preparation.");
  const verified = new Set(request.evidenceRefs.filter(item => item?.verificationStatus === "verified").map(item => item.evidenceId));
  if (!Array.isArray(gate.evidenceRefs) || !gate.evidenceRefs.length || gate.evidenceRefs.some(ref => !verified.has(ref))) throw new Error("Sandbox preparation lacks matching verified evidence.");
}

async function canonicalSourceRoot(rootInput) {
  if (!rootInput || !String(rootInput).trim()) throw new Error("Explicit approved source repository root is required.");
  const resolved = path.resolve(String(rootInput));
  const info = await lstat(resolved);
  if (!info.isDirectory()) throw new Error("Approved source repository root must be a directory.");
  const root = await realpath(resolved);
  const parsedRoot = path.parse(root).root;
  const unsafe = new Set([parsedRoot, os.homedir(), process.env.SystemRoot, process.env.WINDIR].filter(Boolean).map(value => path.resolve(value).toLowerCase()));
  if (unsafe.has(path.resolve(root).toLowerCase())) throw new Error("Drive, system, or home-directory-wide source scope is denied.");
  return root;
}

async function permittedFileSnapshot(absolutePath, relativePath, info) {
  const content = await readFile(absolutePath);
  return { path:relativePath, type:"file", size:info.size, modifiedAt:info.mtime.toISOString(), hash:sha256(content), status:"permitted" };
}

export async function snapshotPermittedSource(root, request, collections = {}) {
  const limits = request.resourceLimits;
  const snapshot = [], candidates = [];
  const excludedPaths = collections.excludedPaths ?? [], ignoredPaths = collections.ignoredPaths ?? [], sensitiveArtifactsExcluded = collections.sensitiveArtifactsExcluded ?? [], symlinksExcluded = collections.symlinksExcluded ?? [], warnings = collections.warnings ?? [];
  const explicitExcludes = new Set(request.excludedPaths.map(value => normalizeRelative(value).replace(/^\.\//, "")));
  const roots = request.requestedWorkspaceMode === "selected_context_copy" ? request.selectedPaths : ["."];
  if (request.requestedWorkspaceMode === "selected_context_copy" && roots.length === 0) throw new Error("Selected-context copy requires selected paths.");
  const seen = new Set();
  const queue = [];
  for (const selected of roots) {
    const resolved = await resolveReadOnlyPath(root, selected);
    queue.push({ absolutePath:resolved.canonicalPath, relativePath:resolved.relativePath === "." ? "" : resolved.relativePath, depth:0 });
  }
  let directories = 0; let snapshotBytes = 0;
  traversal: while (queue.length) {
    const current = queue.shift();
    const key = path.resolve(current.absolutePath).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const relative = current.relativePath;
    if (relative && (explicitExcludes.has(relative) || [...explicitExcludes].some(item => relative.startsWith(`${item}/`)))) { excludedPaths.push({ path:relative, reason:"Explicitly excluded by Sandbox Request." }); continue; }
    if (relative && relative.split("/").some(isIgnoredName)) { ignoredPaths.push({ path:relative, reason:"Ignored dependency, generated, cache, VCS, virtual environment, or temporary path." }); continue; }
    if (relative && isSensitivePath(relative)) { sensitiveArtifactsExcluded.push({ path:relative, reason:"Sensitive-looking artifact excluded without reading or hashing contents." }); continue; }
    if (relative.length > limits.maxPathLength) { warnings.push(msg("max_path_length_reached", "Path length resource limit reached.", relative)); continue; }
    const info = await lstat(current.absolutePath);
    if (info.isSymbolicLink()) { symlinksExcluded.push({ path:relative, reason:"Link excluded and not followed." }); continue; }
    if (info.isDirectory()) {
      if (current.depth > limits.maxDepth || directories >= limits.maxDirectories) { warnings.push(msg("directory_limit_reached", "Directory or depth resource limit reached.", relative)); continue; }
      directories++;
      if (relative) snapshot.push({ path:relative, type:"directory", size:0, modifiedAt:info.mtime.toISOString(), hash:"", status:"permitted" });
      const entries = await readdir(current.absolutePath, { withFileTypes:true });
      for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name))) queue.push({ absolutePath:path.join(current.absolutePath, entry.name), relativePath:normalizeRelative(path.join(relative, entry.name)), depth:current.depth + 1 });
    } else if (info.isFile()) {
      if (info.size > limits.maxSingleFileBytes) { warnings.push(msg("single_file_limit_reached", "File exceeds single-file resource limit.", relative)); continue; }
      if (candidates.length >= limits.maxFiles || snapshotBytes + info.size > limits.maxTotalBytes) { warnings.push(msg("snapshot_limit_reached", "File-count or total-byte limit stopped source snapshot traversal.", relative)); break traversal; }
      const entry = await permittedFileSnapshot(current.absolutePath, relative, info);
      snapshot.push(entry); candidates.push({ ...entry, absolutePath:current.absolutePath }); snapshotBytes += info.size;
    } else warnings.push(msg("unsupported_entry_excluded", "Unsupported filesystem entry excluded.", relative));
  }
  snapshot.sort((a,b) => a.path.localeCompare(b.path)); candidates.sort((a,b) => a.path.localeCompare(b.path));
  return { snapshot, candidates, excludedPaths, ignoredPaths, sensitiveArtifactsExcluded, symlinksExcluded, warnings };
}

function resultBase(request, startedAt) {
  return { sandboxResultId:`sandbox_result_${safeId(request?.sandboxRequestId)}`, schemaVersion:"1.0.0", sandboxRequestRef:request?.sandboxRequestId ?? "sandbox_request_unverified", sandboxId:"sandbox_unverified", status:"blocked", sandboxRoot:"", manifestRef:"", startedAt, completedAt:now(), durationMs:0, copiedFiles:0, copiedBytes:0, warnings:[], errors:[], limitations:["Sandbox readiness authorizes no write-back, process execution, Git operation, or deployment."], cleanupRequired:false, cleanupStatus:"not_required", sideEffectsObserved:[], recommendedNextAction:"block_request", evidenceRefs:request?.evidenceRefs ?? [], auditRefs:request?.auditRefs ?? [] };
}

export async function createSecureSandbox(request, gateResult) {
  const startedAt = now(); const base = resultBase(request, startedAt); let sandboxRoot;
  try {
    validateSandboxRequest(request); validateGate(gateResult, request);
    const sourceRoot = await canonicalSourceRoot(request.sourceRepositoryRoot);
    const sandboxId = `sandbox_${safeId(request.sandboxRequestId)}_${randomBytes(6).toString("hex")}`;
    sandboxRoot = await mkdtemp(path.join(os.tmpdir(), "kaveep-sandbox-"));
    sandboxRoot = await realpath(sandboxRoot);
    if (path.resolve(sourceRoot).toLowerCase() === path.resolve(sandboxRoot).toLowerCase() || isInsideRoot(sourceRoot, sandboxRoot)) throw new Error("Sandbox root must be isolated from the source repository.");
    const collected = await snapshotPermittedSource(sourceRoot, request);
    const copiedFiles = [], copiedDirectories = []; let totalBytes = 0; let limitReached = false;
    for (const item of collected.snapshot.filter(item => item.type === "directory")) { await mkdir(path.join(sandboxRoot, item.path), { recursive:true }); copiedDirectories.push(item.path); }
    for (const candidate of collected.candidates) {
      if (copiedFiles.length >= request.resourceLimits.maxFiles || totalBytes + candidate.size > request.resourceLimits.maxTotalBytes) { collected.warnings.push(msg("copy_limit_reached", "File-count or total-byte resource limit stopped copying.", candidate.path)); limitReached = true; break; }
      const destination = path.resolve(sandboxRoot, candidate.path);
      if (!isInsideRoot(sandboxRoot, destination)) throw new Error("Copy destination escaped the sandbox root.");
      await mkdir(path.dirname(destination), { recursive:true }); await copyFile(candidate.absolutePath, destination);
      copiedFiles.push(candidate.path); totalBytes += candidate.size;
    }
    const createdAt = now();
    const manifest = { sandboxId, schemaVersion:"1.0.0", sandboxRoot, sourceRepositoryRoot:sourceRoot, workspaceMode:request.requestedWorkspaceMode, createdAt, expiresAt:new Date(Date.parse(createdAt) + request.resourceLimits.maxLifetimeSeconds * 1000).toISOString(), copiedFiles, copiedDirectories, excludedPaths:collected.excludedPaths, ignoredPaths:collected.ignoredPaths, sensitiveArtifactsExcluded:collected.sensitiveArtifactsExcluded, symlinksExcluded:collected.symlinksExcluded, totalFiles:copiedFiles.length, totalBytes, resourceLimits:request.resourceLimits, sourceSnapshot:collected.snapshot, warnings:collected.warnings, limitations:["No links were followed.","No sensitive artifact contents were read or copied.","The snapshot is bounded evidence, not a Git replacement.","Sandbox creation does not authorize external write-back."], evidenceRefs:request.evidenceRefs, auditRefs:request.auditRefs, status:limitReached ? "ready_with_warnings" : collected.warnings.length ? "ready_with_warnings" : "ready" };
    const marker = { sandboxId, sandboxRoot, sourceRepositoryRoot:sourceRoot, nonce:randomBytes(16).toString("hex") };
    await writeFile(path.join(sandboxRoot, markerName), JSON.stringify(marker));
    const manifestPath = path.join(sandboxRoot, manifestName); await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    return { result:{ ...base, sandboxId, status:manifest.status, sandboxRoot, manifestRef:manifestPath, completedAt:now(), copiedFiles:copiedFiles.length, copiedBytes:totalBytes, warnings:collected.warnings, cleanupRequired:true, cleanupStatus:"required", recommendedNextAction:"review_sandbox" }, manifest };
  } catch (error) {
    if (sandboxRoot) await rm(sandboxRoot, { recursive:true, force:true });
    return { result:{ ...base, completedAt:now(), errors:[msg("sandbox_preparation_blocked", error.message)] }, manifest:null };
  }
}

export async function cleanupSecureSandbox(manifestPath) {
  const { manifest, root } = await verifySecureSandbox(manifestPath, { requireEditable:false });
  await rm(root, { recursive:true, force:false });
  return { sandboxId:manifest.sandboxId, status:"cleaned", sandboxRoot:root, cleanupStatus:"completed", sourceRepositoryRoot:manifest.sourceRepositoryRoot };
}

export async function verifySecureSandbox(manifestPath, options = {}) {
  if (!manifestPath || path.basename(String(manifestPath)) !== manifestName) throw new Error("Cleanup requires an exact sandbox manifest path.");
  const canonicalManifestPath = path.resolve(String(manifestPath));
  const manifest = JSON.parse(await readFile(canonicalManifestPath, "utf8"));
  const root = await realpath(manifest.sandboxRoot);
  const tempRoot = await realpath(os.tmpdir());
  if (!isInsideRoot(tempRoot, root) || !path.basename(root).startsWith("kaveep-sandbox-") || path.resolve(root).toLowerCase() === path.resolve(manifest.sourceRepositoryRoot).toLowerCase()) throw new Error("Target is not a verified isolated sandbox.");
  if (path.resolve(canonicalManifestPath).toLowerCase() !== path.resolve(root, manifestName).toLowerCase()) throw new Error("Manifest is not the canonical sandbox manifest.");
  if (!/^sandbox_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(manifest.sandboxId)) throw new Error("Sandbox identity is invalid.");
  if (options.requireEditable !== false && (!["ready","ready_with_warnings"].includes(manifest.status) || !manifest.expiresAt || Date.now() > Date.parse(manifest.expiresAt))) throw new Error("Sandbox is not ready and unexpired for editing.");
  const marker = JSON.parse(await readFile(path.join(root, markerName), "utf8"));
  if (marker.sandboxId !== manifest.sandboxId || marker.sandboxRoot !== manifest.sandboxRoot || marker.sourceRepositoryRoot !== manifest.sourceRepositoryRoot || !marker.nonce) throw new Error("Sandbox identity verification failed.");
  return { manifest, root, manifestPath:canonicalManifestPath };
}
