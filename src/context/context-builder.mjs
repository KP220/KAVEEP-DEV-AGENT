import path from "node:path";

const supportedRepositoryStatuses = new Set(["completed", "completed_with_warnings"]);

const categoryRules = {
  schema_creation: ["schemas", "examples", "validation", "specifications", "documentation"],
  documentation_update: ["documentation"],
  repository_analysis: ["documentation", "validation", "package", "source"],
  bug_investigation: ["tests", "source", "validation", "specifications"],
  architecture_design: ["documentation", "specifications", "source"],
  specification_creation: ["specifications", "documentation", "validation"],
  code_creation: ["source", "tests", "validation", "specifications"],
  code_modification: ["source", "tests", "validation", "specifications"],
  refactoring: ["source", "tests", "validation", "specifications"],
  test_creation: ["tests", "source", "validation", "specifications"],
  validation: ["validation", "tests", "schemas"],
  review: ["documentation", "source", "tests", "validation", "specifications"],
  report_generation: ["documentation", "validation"]
};

function safeIdSegment(value) {
  const normalized = String(value ?? "unknown")
    .replace(/^(request_|repo_intel_)/, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "unknown";
}

function artifact(pathValue, relevanceReason, sourceField) {
  return { path: pathValue, relevanceReason, sourceField };
}

function uniqueSorted(items, key = (item) => item.path) {
  const byKey = new Map();
  for (const item of items) {
    const itemKey = key(item);
    if (itemKey && !byKey.has(itemKey)) byKey.set(itemKey, item);
  }
  return [...byKey.values()].sort((left, right) => key(left).localeCompare(key(right)));
}

function observedPaths(repositoryIntelligence) {
  return new Set([
    ...(repositoryIntelligence.fileSummary?.files ?? []),
    ...(repositoryIntelligence.relevantFiles ?? []),
    ...(repositoryIntelligence.detectedArtifacts ?? []).map((item) => item.path),
    ...(repositoryIntelligence.documentationArtifacts ?? []).map((item) => item.path),
    ...(repositoryIntelligence.specificationArtifacts ?? []).map((item) => item.path),
    ...(repositoryIntelligence.schemaArtifacts ?? []).map((item) => item.path),
    ...(repositoryIntelligence.sourceArtifacts ?? []).map((item) => item.path),
    ...(repositoryIntelligence.testArtifacts ?? []).map((item) => item.path),
    ...(repositoryIntelligence.packageAndBuildFiles ?? []).map((item) => item.path),
    ...(repositoryIntelligence.validationEntryPoints ?? []).map((item) => item.path)
  ]);
}

function artifactsFrom(items, reason, sourceField) {
  return (items ?? []).map((item) => artifact(typeof item === "string" ? item : item.path, reason, sourceField));
}

function pathMatchesTarget(candidate, target) {
  const normalizedCandidate = candidate.replace(/\\/g, "/").toLowerCase();
  const normalizedTarget = target.replace(/\\/g, "/").toLowerCase();
  return normalizedCandidate === normalizedTarget || normalizedCandidate.endsWith(`/${normalizedTarget}`);
}

function namedDocumentation(repositoryIntelligence, patterns, reason, directoryPaths) {
  return artifactsFrom(
    (repositoryIntelligence.documentationArtifacts ?? []).filter((item) => patterns.some((pattern) => pattern.test(item.path))),
    reason,
    "documentationArtifacts"
  ).filter((item) => !directoryPaths.has(item.path));
}

function emptyContext(request, repositoryIntelligence, status, missingContext, warnings = []) {
  return {
    contextId: `context_${safeIdSegment(request?.requestId)}`,
    schemaVersion: "1.0.0",
    requestRef: request?.requestId ?? "request_unknown",
    repositoryIntelligenceRef: repositoryIntelligence?.intelligenceId ?? "repo_intel_unknown",
    repositoryRoot: repositoryIntelligence?.repositoryRoot ?? "unavailable",
    relevantFiles: [],
    relevantDirectories: [],
    relevantSchemas: [],
    relevantSpecifications: [],
    relevantDocumentation: [],
    relevantExamples: [],
    relevantValidationEntryPoints: [],
    relevantTests: [],
    architectureContext: [],
    ownershipContext: [],
    integrationContext: [],
    ignoredArtifacts: repositoryIntelligence?.ignoredPaths ?? [],
    assumptions: [
      {
        statement: "Engineering Context is a deterministic selection and does not authorize execution.",
        verificationStatus: "verified"
      }
    ],
    missingContext,
    limitations: [
      "No repository files are read by Context Builder.",
      "Context Builder uses only supplied structured observations."
    ],
    warnings,
    evidenceRefs: repositoryIntelligence?.evidenceRefs ?? [],
    status
  };
}

export function buildEngineeringContext(request, repositoryIntelligence) {
  if (!request || typeof request !== "object") {
    throw new Error("Engineering Request object is required.");
  }

  if (!request.requestId) {
    throw new Error("Engineering Request requestId is required.");
  }

  if (request.status === "no_action" || !String(request.normalizedCommand ?? "").trim()) {
    return emptyContext(request, repositoryIntelligence, "no_action", ["engineering objective"]);
  }
  if (request.status === "unsupported") {
    return emptyContext(request, repositoryIntelligence, "unsupported", ["supported engineering request"]);
  }
  if (request.status === "blocked") {
    return emptyContext(request, repositoryIntelligence, "blocked", request.missingContext ?? []);
  }
  if (!repositoryIntelligence || typeof repositoryIntelligence !== "object") {
    return emptyContext(request, undefined, "needs_context", ["Repository Intelligence"]);
  }
  if (!supportedRepositoryStatuses.has(repositoryIntelligence.status)) {
    const status = repositoryIntelligence.status === "unverified" ? "unverified" : "needs_context";
    return emptyContext(request, repositoryIntelligence, status, ["completed Repository Intelligence"]);
  }

  const directoryPaths = new Set(repositoryIntelligence.directorySummary?.directories ?? []);
  const observed = observedPaths(repositoryIntelligence);
  for (const directory of directoryPaths) observed.delete(directory);
  const selectArtifacts = (items, reason, sourceField) =>
    artifactsFrom(items, reason, sourceField).filter((item) => !directoryPaths.has(item.path));
  const requestedCategories = categoryRules[request.taskType] ?? [];
  const selected = [];
  const missingContext = [...(request.missingContext ?? [])];

  const relevantSchemas = requestedCategories.includes("schemas")
    ? selectArtifacts(repositoryIntelligence.schemaArtifacts, "Schema artifact is relevant to the request type.", "schemaArtifacts")
    : [];
  const relevantSpecifications = requestedCategories.includes("specifications")
    ? selectArtifacts(repositoryIntelligence.specificationArtifacts, "Specification constrains the requested engineering work.", "specificationArtifacts")
    : [];
  const relevantTests = requestedCategories.includes("tests")
    ? selectArtifacts(repositoryIntelligence.testArtifacts, "Test artifact is relevant to validation or investigation.", "testArtifacts")
    : [];
  const relevantExamples = requestedCategories.includes("examples")
    ? artifactsFrom(
        [...observed].filter((file) => /(^|\/)examples?\//i.test(file)),
        "Example artifact supports the requested contract work.",
        "fileSummary.files"
      )
    : [];

  let relevantDocumentation = requestedCategories.includes("documentation")
    ? selectArtifacts(repositoryIntelligence.documentationArtifacts, "Documentation is relevant to the request type.", "documentationArtifacts")
    : [];

  if (request.taskType === "schema_creation") {
    relevantDocumentation = namedDocumentation(
      repositoryIntelligence,
      [/module-contracts/i, /architecture/i, /engineering-contract/i],
      "Canonical contract or architecture documentation constrains schema ownership.",
      directoryPaths
    );
  } else if (request.taskType === "documentation_update") {
    relevantDocumentation = namedDocumentation(
      repositoryIntelligence,
      [/readme/i, /architecture/i, /engineering-contract/i, /^docs\//i],
      "Canonical documentation may require consistency alignment.",
      directoryPaths
    );
  } else if (request.taskType === "repository_analysis") {
    relevantDocumentation = namedDocumentation(
      repositoryIntelligence,
      [/readme/i, /architecture/i, /module-contracts/i, /engineering-contract/i],
      "Repository overview, architecture, and contracts support repository analysis.",
      directoryPaths
    );
  }

  const relevantValidationEntryPoints = requestedCategories.includes("validation")
    ? (repositoryIntelligence.validationEntryPoints ?? []).map((entry) => ({
        path: entry.path,
        entryType: entry.entryType,
        description: entry.description,
        relevanceReason: "Validation entry point is relevant to the request type.",
        executed: false
      }))
    : [];

  if (requestedCategories.includes("source")) {
    selected.push(...selectArtifacts(repositoryIntelligence.sourceArtifacts, "Source artifact is relevant to the request type.", "sourceArtifacts"));
  }
  if (requestedCategories.includes("package")) {
    selected.push(...selectArtifacts(repositoryIntelligence.packageAndBuildFiles, "Package or build metadata supports repository analysis.", "packageAndBuildFiles"));
  }

  for (const target of request.targetFiles ?? []) {
    const matched = [...observed].filter((candidate) => pathMatchesTarget(candidate, target));
    if (matched.length === 0) {
      missingContext.push(`explicit target file not observed: ${target}`);
    }
    selected.push(...matched.map((candidate) => artifact(candidate, "Explicit request target was observed.", "request.targetFiles")));
  }

  selected.push(...relevantSchemas, ...relevantSpecifications, ...relevantDocumentation, ...relevantExamples, ...relevantTests);
  selected.push(...relevantValidationEntryPoints.map((entry) => artifact(entry.path, entry.relevanceReason, "validationEntryPoints")));

  const relevantFiles = uniqueSorted(selected);
  const relevantDirectories = uniqueSorted(
    relevantFiles
      .map((item) => path.posix.dirname(item.path.replace(/\\/g, "/")))
      .filter((directory) => directory && directory !== ".")
      .map((directory) => artifact(directory, "Contains at least one selected relevant artifact.", "derivedFromRelevantFiles"))
  );

  const categoryResults = {
    schemas: relevantSchemas,
    examples: relevantExamples,
    validation: relevantValidationEntryPoints,
    specifications: relevantSpecifications,
    documentation: relevantDocumentation,
    tests: relevantTests,
    source: selected.filter((item) => item.sourceField === "sourceArtifacts"),
    package: selected.filter((item) => item.sourceField === "packageAndBuildFiles")
  };
  for (const category of requestedCategories) {
    if ((categoryResults[category] ?? []).length === 0) missingContext.push(`observed ${category} artifacts`);
  }

  const warnings = uniqueSorted(
    (repositoryIntelligence.warnings ?? []).map((warning) => ({ ...warning })),
    (warning) => `${warning.code}:${warning.path ?? ""}:${warning.message}`
  );
  if (relevantFiles.length === 0) {
    warnings.push({ code: "no_relevant_artifacts", message: "No observed artifacts matched deterministic selection rules." });
  }

  const dedupedMissing = [...new Set(missingContext)].sort();
  const status = relevantFiles.length === 0
    ? "needs_context"
    : dedupedMissing.length > 0 || warnings.length > 0
    ? "completed_with_warnings"
    : "completed";

  return {
    contextId: `context_${safeIdSegment(request.requestId)}`,
    schemaVersion: "1.0.0",
    requestRef: request.requestId,
    repositoryIntelligenceRef: repositoryIntelligence.intelligenceId,
    repositoryRoot: repositoryIntelligence.repositoryRoot,
    relevantFiles,
    relevantDirectories,
    relevantSchemas: uniqueSorted(relevantSchemas),
    relevantSpecifications: uniqueSorted(relevantSpecifications),
    relevantDocumentation: uniqueSorted(relevantDocumentation),
    relevantExamples: uniqueSorted(relevantExamples),
    relevantValidationEntryPoints: uniqueSorted(relevantValidationEntryPoints, (entry) => `${entry.path}:${entry.entryType}`),
    relevantTests: uniqueSorted(relevantTests),
    architectureContext: uniqueSorted(repositoryIntelligence.architectureSignals ?? [], (item) => `${item.path}:${item.signalType}`),
    ownershipContext: uniqueSorted(repositoryIntelligence.ownershipSignals ?? [], (item) => `${item.path}:${item.signalType}`),
    integrationContext: uniqueSorted(repositoryIntelligence.integrationSignals ?? [], (item) => `${item.path}:${item.signalType}`),
    ignoredArtifacts: uniqueSorted(repositoryIntelligence.ignoredPaths ?? []),
    assumptions: [
      {
        statement: "Every selected path was present in supplied Repository Intelligence observations.",
        verificationStatus: "verified"
      },
      {
        statement: "Engineering Context is a deterministic selection and does not authorize execution.",
        verificationStatus: "verified"
      }
    ],
    missingContext: dedupedMissing,
    limitations: [
      "Selection is deterministic and path-based; it does not infer semantic relevance.",
      "Context Builder reads no files and uses only supplied Repository Intelligence observations.",
      "Engineering Context does not replace KAVEEP-RO assessment or authorize engineering work."
    ],
    warnings,
    evidenceRefs: repositoryIntelligence.evidenceRefs ?? [],
    status
  };
}
