import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, open, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { runReadOnlyOrchestration } from "../orchestration/dev-orchestrator.mjs";

const formatVersion = "1.0.0";
const zeroHash = "0".repeat(64);
const forbiddenKey = /(password|passwd|secret|token|credential|private.?key|authorization|api.?key)/i;
const forbiddenValue = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{12,}|\bgh[pousr]_[A-Za-z0-9]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/i;
const iso = (clock) => (clock ? clock() : new Date()).toISOString();

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const hash = (value) => createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");

function assertSafe(value, location = "$") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertSafe(item, `${location}[${index}]`));
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKey.test(key)) throw new Error(`Persistence rejected secret-like key at ${location}.${key}.`);
      assertSafe(child, `${location}.${key}`);
    }
  } else if (typeof value === "string" && forbiddenValue.test(value)) throw new Error(`Persistence rejected credential-like value at ${location}.`);
}

async function atomicJson(filePath, value) {
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  const handle = await open(temporary, "wx", 0o600);
  try { await handle.writeFile(`${canonical(value)}\n`, "utf8"); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, filePath);
}

async function withLock(root, operation) {
  const lockPath = path.join(root, ".store.lock");
  let handle;
  try { handle = await open(lockPath, "wx", 0o600); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    let owner;
    try { owner = await readJson(lockPath); } catch { throw new Error("Durable store lock is unreadable; manual recovery is required."); }
    let alive = true;
    try { process.kill(owner.pid, 0); } catch (checkError) { if (checkError.code === "ESRCH") alive = false; else throw new Error("Durable store lock ownership cannot be verified."); }
    if (alive) throw new Error(`Durable store is locked by live process ${owner.pid}.`);
    await rm(lockPath);
    handle = await open(lockPath, "wx", 0o600);
  }
  await handle.writeFile(canonical({ pid: process.pid, acquiredAt: new Date().toISOString() }), "utf8");
  await handle.sync();
  try { return await operation(); } finally { await handle.close(); await rm(lockPath, { force: true }); }
}

async function readJson(filePath) { return JSON.parse(await readFile(filePath, "utf8")); }

export async function createDurableStore(storeRoot, policy = {}, options = {}) {
  const resolved = path.resolve(storeRoot);
  await mkdir(resolved, { recursive: true });
  const root = await realpath(resolved);
  const manifestPath = path.join(root, "store-manifest.json");
  try { await stat(manifestPath); return readJson(manifestPath); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const manifest = {
    storeId: `durable_store_${hash(root).slice(0, 16)}`, schemaVersion: "1.0.0", formatVersion,
    storeRoot: root,
    redactionPolicy: { mode: "reject_on_secret", forbiddenKeyClasses: ["password", "secret", "token", "credential", "private_key", "authorization", "api_key"] },
    retentionPolicy: { retentionDays: policy.retentionDays ?? 90, maxRuns: policy.maxRuns ?? 1000, automaticDeletion: false },
    migrationPolicy: { implicitMigration: false, unknownMajorVersion: "fail_closed" },
    createdAt: iso(options.clock)
  };
  await atomicJson(manifestPath, manifest);
  await mkdir(path.join(root, "artifacts"), { recursive: true });
  await mkdir(path.join(root, "runs"), { recursive: true });
  return manifest;
}

async function verifyStore(root) {
  const canonicalRoot = await realpath(path.resolve(root));
  const manifest = await readJson(path.join(canonicalRoot, "store-manifest.json"));
  if (manifest.formatVersion.split(".")[0] !== formatVersion.split(".")[0]) throw new Error("Unsupported durable store major format version.");
  if (manifest.storeRoot !== canonicalRoot) throw new Error("Durable store root identity mismatch.");
  return { root: canonicalRoot, manifest };
}

async function putArtifact(root, value) {
  assertSafe(value);
  const content = canonical(value); const digest = hash(content);
  const artifactPath = path.join(root, "artifacts", `${digest}.json`);
  try { await stat(artifactPath); } catch (error) { if (error.code !== "ENOENT") throw error; await atomicJson(artifactPath, value); }
  return digest;
}

async function getArtifact(root, digest) {
  const content = await readFile(path.join(root, "artifacts", `${digest}.json`), "utf8");
  const value = JSON.parse(content);
  if (hash(canonical(value)) !== digest) throw new Error(`Artifact integrity mismatch: ${digest}`);
  return value;
}

async function appendEvent(root, runId, type, payload, clock) {
  const runDir = path.join(root, "runs", runId); const eventsPath = path.join(runDir, "events.jsonl");
  let events = [];
  try { events = (await readFile(eventsPath, "utf8")).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const payloadHash = await putArtifact(root, payload);
  const body = { eventId: `audit_event_${runId}_${String(events.length + 1).padStart(4, "0")}`, schemaVersion: "1.0.0", runRef: runId, sequence: events.length + 1, previousEventHash: events.at(-1)?.eventHash ?? zeroHash, eventType: type, payloadHash, createdAt: iso(clock) };
  const event = { ...body, eventHash: hash(body) };
  await mkdir(runDir, { recursive: true });
  await appendFile(eventsPath, `${canonical(event)}\n`, { encoding: "utf8", mode: 0o600 });
  return event;
}

export async function persistReadOnlyOrchestration(storeRoot, input, options = {}) {
  const { root } = await verifyStore(storeRoot); assertSafe(input);
  const runId = `dev_run_${String(options.runId ?? randomUUID()).replace(/[^A-Za-z0-9_-]/g, "_")}`;
  return withLock(root, async () => {
    const inputArtifactHash = await putArtifact(root, input);
    const runDir = path.join(root, "runs", runId);
    const recordPath = path.join(runDir, "run-record.json");
    const record = { durableRunId: runId, schemaVersion: "1.0.0", formatVersion, attempt: options.attempt ?? 1, parentRunRef: options.parentRunRef, inputArtifactHash, resultArtifactHash: null, lastEventHash: zeroHash, lastSequence: 0, state: "received", status: "active", createdAt: iso(options.clock), updatedAt: iso(options.clock) };
    if (record.parentRunRef === undefined) delete record.parentRunRef;
    await atomicJson(recordPath, record);
    let last = await appendEvent(root, runId, "run_created", { inputArtifactHash, attempt: record.attempt, parentRunRef: record.parentRunRef ?? null }, options.clock);
    record.lastEventHash = last.eventHash; record.lastSequence = last.sequence; await atomicJson(recordPath, record);
    await atomicJson(path.join(runDir, "checkpoint.json"), { runRef: runId, sequence: last.sequence, eventHash: last.eventHash, state: "received", transitionSequence: 0, inputArtifactHash, durablyPersisted: true, resumable: true, createdAt: iso(options.clock) });
    const transitionSink = async ({ transition, checkpoint }) => {
      last = await appendEvent(root, runId, "state_transition", { transition, checkpoint }, options.clock);
      record.lastEventHash = last.eventHash; record.lastSequence = last.sequence; record.state = transition.toState; record.updatedAt = iso(options.clock);
      await atomicJson(path.join(runDir, "checkpoint.json"), { runRef: runId, sequence: last.sequence, eventHash: last.eventHash, state: transition.toState, transitionSequence: transition.sequence, inputArtifactHash, durablyPersisted: true, resumable: true, createdAt: iso(options.clock) });
      await atomicJson(recordPath, record);
    };
    const result = await runReadOnlyOrchestration(input, { ...options, runId: runId.replace(/^dev_run_/, ""), transitionSink });
    const resultArtifactHash = await putArtifact(root, result);
    last = await appendEvent(root, runId, "run_terminal", { status: result.status, state: result.state, resultArtifactHash }, options.clock);
    Object.assign(record, { resultArtifactHash, lastEventHash: last.eventHash, lastSequence: last.sequence, state: result.state, status: result.status, updatedAt: iso(options.clock) });
    await atomicJson(recordPath, record);
    return { record, result };
  });
}

export async function replayDurableRun(storeRoot, runId) {
  try {
    const { root } = await verifyStore(storeRoot); const runDir = path.join(root, "runs", runId);
    const record = await readJson(path.join(runDir, "run-record.json"));
    const lines = (await readFile(path.join(runDir, "events.jsonl"), "utf8")).trim().split(/\r?\n/).filter(Boolean);
    let previous = zeroHash; let sequence = 0; const verifiedEvents = [];
    for (const line of lines) {
      const event = JSON.parse(line); sequence += 1;
      const { eventHash, ...body } = event;
      if (event.sequence !== sequence || event.previousEventHash !== previous || hash(body) !== eventHash) throw new Error(`Audit chain mismatch at sequence ${sequence}.`);
      await getArtifact(root, event.payloadHash); previous = eventHash;
      verifiedEvents.push(event);
    }
    if (record.lastSequence !== sequence || record.lastEventHash !== previous) throw new Error("Run record does not correlate with the audit chain.");
    await getArtifact(root, record.inputArtifactHash);
    if (record.resultArtifactHash) await getArtifact(root, record.resultArtifactHash);
    const checkpoint = await readJson(path.join(runDir, "checkpoint.json"));
    const checkpointEvent = verifiedEvents[checkpoint.sequence - 1];
    if (checkpoint.runRef !== runId || !checkpointEvent || checkpoint.eventHash !== checkpointEvent.eventHash || checkpoint.sequence > record.lastSequence) throw new Error("Durable checkpoint correlation is invalid.");
    return { replayId: `replay_${runId}`, schemaVersion: "1.0.0", runRef: runId, status: "verified", eventCount: sequence, lastEventHash: previous, corruptionFindings: [], recoveryAllowed: true };
  } catch (error) {
    return { replayId: `replay_${runId}`, schemaVersion: "1.0.0", runRef: runId, status: "corrupted", eventCount: 0, lastEventHash: null, corruptionFindings: [{ code: "durable_store_corruption", message: error.message }], recoveryAllowed: false };
  }
}

export async function recoverDurableRun(storeRoot, runId, options = {}) {
  const replay = await replayDurableRun(storeRoot, runId);
  if (!replay.recoveryAllowed) return { recoveryId: `recovery_${runId}`, schemaVersion: "1.0.0", sourceRunRef: runId, recoveredRunRef: null, status: "blocked", governanceRecheckRequired: true, restartState: "received", replay, reason: "Corruption prevents recovery." };
  const { root } = await verifyStore(storeRoot); const record = await readJson(path.join(root, "runs", runId, "run-record.json"));
  const input = await getArtifact(root, record.inputArtifactHash);
  const recovered = await persistReadOnlyOrchestration(root, input, { ...options, runId: `${runId.replace(/^dev_run_/, "")}_recovery_${record.attempt + 1}`, attempt: record.attempt + 1, parentRunRef: runId });
  return { recoveryId: `recovery_${runId}_${record.attempt + 1}`, schemaVersion: "1.0.0", sourceRunRef: runId, recoveredRunRef: recovered.record.durableRunId, status: "restarted_from_received", governanceRecheckRequired: true, restartState: "received", replay, reason: "Verified recovery restarted the full read-only state machine from received." };
}
