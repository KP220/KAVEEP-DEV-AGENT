import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { resolveReadOnlyPath } from "../repository/repository-intelligence.mjs";

const textDecoder = new TextDecoder("utf-8", { fatal: true });
const limitations = [
  "Hash comparison detects observable artifact change but does not infer semantic equivalence.",
  "This capability creates no authority, POLICY decision, approval, KCP decision, or execution authorization.",
  "Refreshing a snapshot is not approval of a governance change."
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const now = (clock) => (clock ? clock() : new Date()).toISOString();
const safeId = (value) => String(value ?? "unknown").replace(/[^A-Za-z0-9_-]/g, "_").replace(/^_+|_+$/g, "") || "unknown";
const normalizedPath = (value) => path.posix.normalize(String(value).replace(/\\/g, "/")).replace(/^\.\//, "");

function validateDocuments(documents) {
  if (!Array.isArray(documents) || documents.length === 0) throw new Error("At least one explicit authority document is required.");
  const paths = new Set();
  const precedences = new Set();
  const documentIds = new Set();
  for (const document of documents) {
    if (!document || !document.documentId || !document.path || !document.authorityType || !document.ownerRepository) {
      throw new Error("Every authority document requires documentId, path, authorityType, and ownerRepository.");
    }
    if (!Number.isInteger(document.precedence) || document.precedence < 1) throw new Error("Authority precedence must be a positive integer.");
    const relativePath = normalizedPath(document.path);
    if (paths.has(relativePath.toLowerCase())) throw new Error(`Duplicate authority path: ${relativePath}`);
    if (precedences.has(document.precedence)) throw new Error(`Duplicate authority precedence: ${document.precedence}`);
    if (documentIds.has(document.documentId)) throw new Error(`Duplicate authority documentId: ${document.documentId}`);
    paths.add(relativePath.toLowerCase());
    precedences.add(document.precedence);
    documentIds.add(document.documentId);
  }
}

async function readAuthorityDocument(root, relativePath, maxFileBytes) {
  const resolved = await resolveReadOnlyPath(root, relativePath);
  if (resolved.sensitive) throw new Error(`Sensitive paths cannot be authority inputs: ${relativePath}`);
  if (resolved.ignored) throw new Error(`Ignored paths cannot be authority inputs: ${relativePath}`);
  const metadata = await stat(resolved.canonicalPath);
  if (!metadata.isFile()) throw new Error(`Authority path is not a regular file: ${relativePath}`);
  if (metadata.size > maxFileBytes) throw new Error(`Authority document exceeds maxFileBytes: ${relativePath}`);
  const content = await readFile(resolved.canonicalPath);
  textDecoder.decode(content);
  if (content.includes(0)) throw new Error(`Authority document is binary: ${relativePath}`);
  return { relativePath: normalizedPath(resolved.relativePath), content };
}

export async function createAuthoritySnapshot(repositoryRoot, documents, options = {}) {
  validateDocuments(documents);
  const canonicalRoot = await realpath(path.resolve(repositoryRoot));
  const rootStat = await stat(canonicalRoot);
  if (!rootStat.isDirectory()) throw new Error("Approved authority repository root must be a directory.");
  const maxFileBytes = options.maxFileBytes ?? 2 * 1024 * 1024;
  if (!Number.isInteger(maxFileBytes) || maxFileBytes < 1 || maxFileBytes > 10 * 1024 * 1024) throw new Error("maxFileBytes is outside the supported bound.");

  const authorityDocuments = [];
  const authorityChain = [];
  for (const document of [...documents].sort((left, right) => left.precedence - right.precedence)) {
    const observed = await readAuthorityDocument(canonicalRoot, document.path, maxFileBytes);
    const documentRef = `authority_document_${safeId(document.documentId.replace(/^authority_document_/, ""))}`;
    authorityDocuments.push({
      documentId: documentRef,
      path: observed.relativePath,
      sha256: sha256(observed.content),
      bytes: observed.content.length,
      verificationStatus: "verified"
    });
    authorityChain.push({
      precedence: document.precedence,
      authorityType: document.authorityType,
      ownerRepository: document.ownerRepository,
      documentRef
    });
  }

  const suffix = safeId(options.snapshotId ?? path.basename(canonicalRoot));
  return {
    authoritySnapshotId: `authority_snapshot_${suffix}`,
    schemaVersion: "1.0.0",
    repositoryRoot: canonicalRoot,
    authorityChain,
    authorityDocuments,
    limitations,
    warnings: [],
    evidenceRefs: authorityDocuments.map((_, index) => `evidence_authority_${suffix}_${String(index + 1).padStart(3, "0")}`),
    status: "verified",
    createdAt: now(options.clock)
  };
}

function validateMissionLock(snapshot, missionLock) {
  if (!missionLock || missionLock.status !== "active") throw new Error("An active Mission Lock is required.");
  if (missionLock.authoritySnapshotRef !== snapshot.authoritySnapshotId) throw new Error("Mission Lock does not reference the supplied Authority Snapshot.");
  const documentRefs = new Set(snapshot.authorityDocuments.map((document) => document.documentId));
  if (!(missionLock.lockedPrinciples ?? []).length) throw new Error("Mission Lock requires at least one locked principle.");
  if (!(missionLock.prohibitedAutonomousChanges ?? []).length) throw new Error("Mission Lock requires prohibited autonomous change categories.");
  const protectedPaths = new Set((missionLock.protectedArtifacts ?? []).map((item) => normalizedPath(item.path).toLowerCase()));
  for (const document of snapshot.authorityDocuments) {
    if (!protectedPaths.has(normalizedPath(document.path).toLowerCase())) throw new Error(`Mission Lock does not protect authority document: ${document.path}`);
  }
  for (const principle of missionLock.lockedPrinciples ?? []) {
    if (!documentRefs.has(principle.sourceDocumentRef)) throw new Error(`Mission Lock principle references an unknown authority document: ${principle.sourceDocumentRef}`);
  }
}

const finding = (code, severity, message, extra = {}) => ({ code, severity, message, ...extra });

export async function detectGovernanceDrift(snapshot, missionLock, options = {}) {
  if (!snapshot || snapshot.status !== "verified") throw new Error("A verified Authority Snapshot is required.");
  validateMissionLock(snapshot, missionLock);
  const canonicalRoot = await realpath(path.resolve(options.repositoryRoot ?? snapshot.repositoryRoot));
  if (canonicalRoot !== snapshot.repositoryRoot) throw new Error("Governance drift checks must use the exact snapshotted repository root.");

  const checkedDocuments = [];
  const findings = [];
  for (const document of snapshot.authorityDocuments) {
    try {
      const observed = await readAuthorityDocument(canonicalRoot, document.path, options.maxFileBytes ?? 2 * 1024 * 1024);
      const observedSha256 = sha256(observed.content);
      const status = observedSha256 === document.sha256 ? "aligned" : "modified";
      checkedDocuments.push({ documentRef: document.documentId, path: document.path, expectedSha256: document.sha256, observedSha256, status });
      if (status === "modified") findings.push(finding("authority_document_modified", "critical", "Authority document content differs from the verified snapshot.", { path: document.path }));
    } catch (error) {
      const missing = error?.code === "ENOENT";
      checkedDocuments.push({ documentRef: document.documentId, path: document.path, expectedSha256: document.sha256, observedSha256: null, status: missing ? "missing" : "unverified" });
      findings.push(finding(missing ? "authority_document_missing" : "authority_document_unverified", missing ? "critical" : "high", error.message, { path: document.path }));
    }
  }

  const protectedPaths = new Map((missionLock.protectedArtifacts ?? []).map((item) => [normalizedPath(item.path).toLowerCase(), item]));
  const lockedPrinciples = new Set((missionLock.lockedPrinciples ?? []).map((item) => item.principleId));
  const prohibitedCategories = new Set(missionLock.prohibitedAutonomousChanges ?? []);
  const protectedProposalFindings = [];
  for (const change of options.proposedChanges ?? []) {
    const paths = [change.path, change.fromPath, change.toPath].filter(Boolean).map(normalizedPath);
    for (const candidate of paths) {
      if (path.posix.isAbsolute(candidate) || /^[A-Za-z]:\//.test(candidate) || candidate === ".." || candidate.startsWith("../")) {
        protectedProposalFindings.push(finding("invalid_proposed_change_path", "critical", "Proposed governance comparison path must be repository-relative and contained.", { path: candidate }));
        continue;
      }
      const protectedArtifact = protectedPaths.get(candidate.toLowerCase());
      if (protectedArtifact) protectedProposalFindings.push(finding("protected_artifact_change_proposed", "critical", protectedArtifact.reason, { path: candidate }));
    }
    for (const principleRef of change.affectedPrincipleRefs ?? []) {
      if (lockedPrinciples.has(principleRef)) protectedProposalFindings.push(finding("locked_principle_change_proposed", "critical", "Proposed change declares an effect on a mission-locked principle.", { principleRef }));
    }
    for (const changeCategory of change.changeCategories ?? []) {
      if (prohibitedCategories.has(changeCategory)) protectedProposalFindings.push(finding("prohibited_autonomous_change_proposed", "critical", "Proposed autonomous change belongs to a prohibited mission or governance category.", { changeCategory }));
    }
  }

  const unique = (items) => [...new Map(items.map((item) => [JSON.stringify(item), item])).values()].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const normalizedFindings = unique(findings);
  const normalizedProposalFindings = unique(protectedProposalFindings);
  const hasUnverified = checkedDocuments.some((document) => document.status === "unverified");
  const blocked = normalizedFindings.some((item) => item.code !== "authority_document_unverified") || normalizedProposalFindings.length > 0;
  const status = blocked ? "blocked" : hasUnverified ? "unverified" : "aligned";
  const suffix = safeId(options.resultId ?? snapshot.authoritySnapshotId.replace(/^authority_snapshot_/, ""));

  return {
    governanceDriftResultId: `governance_drift_${suffix}`,
    schemaVersion: "1.0.0",
    authoritySnapshotRef: snapshot.authoritySnapshotId,
    missionLockRef: missionLock.missionLockId,
    repositoryRoot: canonicalRoot,
    checkedDocuments,
    findings: normalizedFindings,
    protectedProposalFindings: normalizedProposalFindings,
    limitations,
    evidenceRefs: snapshot.evidenceRefs,
    status,
    decision: status === "aligned" ? "continue_read_only_pipeline" : status === "blocked" ? "block_governance_drift" : "gather_more_evidence",
    recommendedNextAction: normalizedProposalFindings.length > 0 ? "request_governance_process" : status === "blocked" ? "restore_or_review_authority" : status === "unverified" ? "gather_more_evidence" : "continue_read_only_pipeline",
    checkedAt: now(options.clock)
  };
}
