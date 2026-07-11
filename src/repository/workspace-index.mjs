import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, stat } from "node:fs/promises";
import path from "node:path";

const VERSION = "1.0.0";
const ignored = new Set([".git", "node_modules", "dist", "build", "coverage", ".cache", ".next", "target", "vendor", "__pycache__", ".venv", "venv", "tmp", "temp"]);
const sensitive = [/^\.env(?:\.|$)/i, /credential/i, /secret/i, /token/i, /password/i, /passwd/i, /private[-_]?key/i, /^id_(rsa|dsa|ecdsa|ed25519)$/i, /\.(pem|key|p12|pfx)$/i];
const credentialValue = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/gi;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const normalized = (value) => value.split(path.sep).join("/");
const inside = (root, candidate) => { const relative = path.relative(root, candidate); return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)); };
const timestamp = (clock) => (clock?.() ?? new Date()).toISOString();
async function atomic(file, value) { const temporary = `${file}.${randomUUID()}.tmp`; await mkdir(path.dirname(file), { recursive: true }); const handle = await open(temporary, "wx", 0o600); try { await handle.writeFile(`${JSON.stringify(value)}\n`); await handle.sync(); } finally { await handle.close(); } await rename(temporary, file); }
function isSensitive(relative) { return relative.split("/").some((part) => sensitive.some((pattern) => pattern.test(part))); }
function terms(value) { return [...new Set(String(value).toLowerCase().match(/[\p{L}\p{N}_./-]{2,}/gu) ?? [])]; }
function redactCredentialValues(value) { let redactionCount = 0; const text = String(value).replace(credentialValue, () => { redactionCount += 1; return "[REDACTED]"; }); return { text, redactionCount }; }

async function walk(root, limits) {
  const files = []; const exclusions = []; const queue = [{ absolute: root, depth: 0 }]; let directories = 0;
  while (queue.length && files.length < limits.maxFiles && directories < limits.maxDirectories) {
    const current = queue.shift(); directories += 1;
    const entries = await readdir(current.absolute, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current.absolute, entry.name); const relative = normalized(path.relative(root, absolute));
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) { exclusions.push({ path: relative, reason: "symlink" }); continue; }
      if (isSensitive(relative)) { exclusions.push({ path: relative, reason: "sensitive_path" }); continue; }
      if (entry.isDirectory()) { if (ignored.has(entry.name)) { exclusions.push({ path: relative, reason: "ignored_path" }); continue; } if (current.depth < limits.maxDepth) queue.push({ absolute, depth: current.depth + 1 }); continue; }
      if (!entry.isFile()) continue;
      if (info.size > limits.maxFileBytes) { exclusions.push({ path: relative, reason: "file_too_large" }); continue; }
      files.push({ absolute, relative, size: info.size, modifiedMs: Math.trunc(info.mtimeMs) });
      if (files.length >= limits.maxFiles) break;
    }
  }
  return { files, exclusions, directories, truncated: queue.length > 0 || files.length >= limits.maxFiles };
}

export async function buildWorkspaceIndex(repositoryRoot, indexRoot, options = {}) {
  const limits = { maxFiles: options.maxFiles ?? 20000, maxDirectories: options.maxDirectories ?? 5000, maxDepth: options.maxDepth ?? 30, maxFileBytes: options.maxFileBytes ?? 1048576 };
  const source = await realpath(path.resolve(repositoryRoot)); await mkdir(path.resolve(indexRoot), { recursive: true }); const store = await realpath(path.resolve(indexRoot));
  if (inside(source, store)) throw new Error("Workspace index store must be outside the indexed repository.");
  const snapshotFile = path.join(store, "workspace-index.json"); let previous = null;
  try { previous = JSON.parse(await readFile(snapshotFile, "utf8")); if (previous.formatVersion.split(".")[0] !== VERSION.split(".")[0] || previous.repositoryRoot !== source) throw new Error("Workspace index identity or major version mismatch."); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const prior = new Map((previous?.files ?? []).map((item) => [item.path, item])); const traversal = await walk(source, limits); const files = []; let reused = 0; let indexed = 0;
  await mkdir(path.join(store, "objects"), { recursive: true });
  for (const candidate of traversal.files) {
    const old = prior.get(candidate.relative);
    if (old && old.size === candidate.size && old.modifiedMs === candidate.modifiedMs) { files.push(old); reused += 1; continue; }
    const canonical = await realpath(candidate.absolute); if (!inside(source, canonical)) continue;
    const buffer = await readFile(canonical); if (buffer.includes(0)) { traversal.exclusions.push({ path: candidate.relative, reason: "binary_file" }); continue; }
    let content; try { content = new TextDecoder("utf-8", { fatal: true }).decode(buffer); } catch { traversal.exclusions.push({ path: candidate.relative, reason: "non_utf8" }); continue; }
    const contentHash = digest(buffer); const objectFile = path.join(store, "objects", `${contentHash}.txt`);
    try { await stat(objectFile); } catch (error) { if (error.code !== "ENOENT") throw error; const handle = await open(objectFile, "wx", 0o600); try { await handle.writeFile(buffer); await handle.sync(); } finally { await handle.close(); } }
    files.push({ path: candidate.relative, size: candidate.size, modifiedMs: candidate.modifiedMs, contentHash, searchTerms: terms(`${candidate.relative}\n${content}`).slice(0, 5000) }); indexed += 1;
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const snapshot = { indexId: `workspace_index_${digest(source).slice(0, 16)}`, schemaVersion: VERSION, formatVersion: VERSION, repositoryRoot: source, indexRoot: store, files, exclusions: traversal.exclusions.sort((a, b) => a.path.localeCompare(b.path)), stats: { totalFiles: files.length, indexedFiles: indexed, reusedFiles: reused, removedFiles: [...prior.keys()].filter((item) => !files.some((file) => file.path === item)).length, directoriesObserved: traversal.directories, truncated: traversal.truncated }, limitations: ["Index data is advisory and reverified against current file hashes before retrieval.", "No links, sensitive paths, binary files, or ignored dependency/generated trees are indexed."], createdAt: timestamp(options.clock) };
  await atomic(snapshotFile, snapshot); return snapshot;
}

export async function searchWorkspaceIndex(indexRoot, query, options = {}) {
  const store = await realpath(path.resolve(indexRoot)); const snapshot = JSON.parse(await readFile(path.join(store, "workspace-index.json"), "utf8"));
  if (snapshot.formatVersion.split(".")[0] !== VERSION.split(".")[0] || snapshot.indexRoot !== store) throw new Error("Workspace index identity or major version mismatch.");
  const queryTerms = terms(query); if (!queryTerms.length) return { query, results: [], stalePaths: [], status: "no_action" };
  const ranked = snapshot.files.map((file) => { const pathLower = file.path.toLowerCase(); let score = 0; for (const term of queryTerms) { if (pathLower.includes(term)) score += 20; if (file.searchTerms.includes(term)) score += 3; } if (pathLower.includes(String(query).toLowerCase())) score += 25; return { file, score }; }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path));
  const results = []; const stalePaths = []; let characters = 0;
  for (const { file, score } of ranked) {
    if (results.length >= (options.maxResults ?? 20)) break;
    const absolute = path.resolve(snapshot.repositoryRoot, file.path); if (!inside(snapshot.repositoryRoot, absolute)) continue;
    try { const info = await lstat(absolute); if (!info.isFile() || info.isSymbolicLink()) throw new Error("not regular"); const canonical = await realpath(absolute); if (!inside(snapshot.repositoryRoot, canonical)) throw new Error("escaped"); const buffer = await readFile(canonical); if (digest(buffer) !== file.contentHash) { stalePaths.push(file.path); continue; } const content = buffer.toString("utf8"); const lower = content.toLowerCase(); const positions = queryTerms.map((term) => lower.indexOf(term)).filter((position) => position >= 0); const center = positions.length ? Math.min(...positions) : 0; const radius = Math.floor((options.maxSnippetCharacters ?? 1000) / 2); const start = Math.max(0, center - radius); const rawSnippet = content.slice(start, start + (options.maxSnippetCharacters ?? 1000)); const redacted = redactCredentialValues(rawSnippet); const snippet = redacted.text; if (characters + snippet.length > (options.maxContextCharacters ?? 20000)) break; characters += snippet.length; results.push({ path: file.path, score, contentHash: file.contentHash, snippet, snippetStart: start, redactionCount: redacted.redactionCount }); } catch { stalePaths.push(file.path); }
  }
  return { query, results, stalePaths: [...new Set(stalePaths)].sort(), status: results.length ? (stalePaths.length ? "completed_with_warnings" : "completed") : (stalePaths.length ? "stale" : "no_matches") };
}
