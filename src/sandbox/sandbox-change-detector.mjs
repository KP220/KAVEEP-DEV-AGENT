import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { isInsideRoot, normalizeRelative } from "../repository/repository-intelligence.mjs";

const internal = new Set([".kaveep-sandbox.json", "sandbox-manifest.json", ".kaveep-changes"]);
const hash = value => createHash("sha256").update(value).digest("hex");

export async function detectSandboxChanges(manifest) {
  if (!manifest?.sandboxRoot || !Array.isArray(manifest.sourceSnapshot)) throw new Error("Valid Sandbox Manifest is required.");
  const root = path.resolve(manifest.sandboxRoot);
  const current = new Map(); const warnings = [], unverifiedEntries = [];
  const queue = [{ absolute:root, relative:"", depth:0 }]; let files = 0; let bytes = 0;
  while (queue.length) {
    const entry = queue.shift();
    if (entry.depth > manifest.resourceLimits.maxDepth) { warnings.push({ code:"change_detection_depth_limit", message:"Change detection depth limit reached.", path:entry.relative }); continue; }
    for (const child of await readdir(entry.absolute, { withFileTypes:true })) {
      const relative = normalizeRelative(path.join(entry.relative, child.name));
      if (!entry.relative && internal.has(child.name)) continue;
      const absolute = path.resolve(root, relative);
      if (!isInsideRoot(root, absolute)) { unverifiedEntries.push(relative); continue; }
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) { unverifiedEntries.push(relative); warnings.push({ code:"sandbox_link_unverified", message:"Link was not followed during change detection.", path:relative }); continue; }
      if (info.isDirectory()) queue.push({ absolute, relative, depth:entry.depth + 1 });
      else if (info.isFile()) {
        if (++files > manifest.resourceLimits.maxFiles || info.size > manifest.resourceLimits.maxSingleFileBytes || bytes + info.size > manifest.resourceLimits.maxTotalBytes) { unverifiedEntries.push(relative); warnings.push({ code:"change_detection_limit", message:"Resource limit prevented verification.", path:relative }); continue; }
        const content = await readFile(absolute); bytes += info.size; current.set(relative, { size:info.size, hash:hash(content) });
      }
    }
  }
  const original = new Map(manifest.sourceSnapshot.filter(item => item.type === "file" && item.status === "permitted").map(item => [item.path, item]));
  const addedFiles = [], modifiedFiles = [], deletedFiles = [], unchangedFiles = [];
  for (const [relative, item] of current) {
    const before = original.get(relative);
    if (!before) addedFiles.push(relative);
    else if (before.hash !== item.hash || before.size !== item.size) modifiedFiles.push(relative);
    else unchangedFiles.push(relative);
  }
  for (const relative of original.keys()) if (!current.has(relative)) deletedFiles.push(relative);
  const sort = list => list.sort((a,b) => a.localeCompare(b));
  return { sandboxId:manifest.sandboxId, addedFiles:sort(addedFiles), modifiedFiles:sort(modifiedFiles), deletedFiles:sort(deletedFiles), unchangedFiles:sort(unchangedFiles), excludedFiles:sort([...manifest.excludedPaths, ...manifest.ignoredPaths, ...manifest.sensitiveArtifactsExcluded, ...manifest.symlinksExcluded].map(item => item.path)), unverifiedEntries:sort(unverifiedEntries), warnings, resourceLimitEffects:warnings.filter(item => item.code.includes("limit")), sourceRepositoryModified:false };
}
