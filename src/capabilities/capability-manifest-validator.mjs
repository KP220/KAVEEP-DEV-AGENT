import {
  lstat,
  readFile,
  realpath
} from "node:fs/promises";
import path from "node:path";

const MANIFEST_PATH = "capabilities/repository-capability-manifest.json";
const PACKAGE_PATH = "package.json";
const ARCHITECTURE_PATH = "ARCHITECTURE.md";
const QUALITY_GATES_PATH = "tools/run-quality-gates.mjs";

const CAPABILITY_STATUSES = new Set([
  "PROPOSED",
  "SPECIFIED",
  "IMPLEMENTED",
  "SELF_TESTED",
  "INTEGRATION_TESTED",
  "LIVE_CERTIFIED",
  "INDEPENDENTLY_REVIEWED",
  "PRODUCTION_PROVEN",
  "DEPRECATED",
  "BLOCKED",
  "UNVERIFIED"
]);

const CERTIFICATION_STATUSES = new Set([
  "NOT_REQUIRED",
  "UNVERIFIED",
  "SELF_TESTED",
  "INTEGRATION_TESTED",
  "LIVE_CERTIFIED",
  "INDEPENDENTLY_REVIEWED",
  "PRODUCTION_PROVEN",
  "FAILED",
  "BLOCKED",
  "EXPIRED"
]);

const EVIDENCE_TYPES = new Set([
  "SPECIFICATION",
  "IMPLEMENTATION",
  "TEST",
  "QUALITY_GATE",
  "INTEGRATION_RESULT",
  "LIVE_CERTIFICATION",
  "INDEPENDENT_REVIEW",
  "PRODUCTION_RECORD",
  "AUTHORITY_DOCUMENT",
  "LIMITATION_RECORD"
]);

const EVIDENCE_STATUSES = new Set([
  "PRESENT",
  "PASSED",
  "FAILED",
  "UNVERIFIED",
  "UNAVAILABLE",
  "EXPIRED",
  "BLOCKED"
]);

const AUTHORITY_PATHS = new Set([
  "ENGINEERING-CONSTITUTION.md",
  "ENGINEERING-CHARTER.md",
  "ENGINEERING-PHILOSOPHY.md",
  "ARCHITECTURE.md",
  "ENGINEERING-LIFECYCLE.md",
  "ENGINEERING-WORKFLOW.md",
  "REPOSITORY-STANDARD.md"
]);

const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const EVIDENCE_ID_PATTERN = /^evidence_[a-z0-9][a-z0-9_-]*$/;
const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const SPEC_PATH_PATTERN = /^specs\/SPEC-[0-9]{3}\.md$/;
const MILESTONE_PATTERN = /^SPEC-[0-9]{3}$/;
const TEST_PATH_PATTERN = /^tools\/test-[a-z0-9][a-z0-9-]*\.mjs$/;

function stableCompare(left, right) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right), "en");
}

function normalizeFindingPath(value) {
  return typeof value === "string" && value.length > 0 ? value : "$";
}

function createError(code, message, findingPath = "$", capabilityId = null) {
  return {
    code,
    message,
    path: normalizeFindingPath(findingPath),
    capabilityId,
    blocking: true
  };
}

function createDrift(
  code,
  classification,
  severity,
  message,
  findingPath = "$",
  capabilityId = null,
  expected = null,
  observed = null,
  blocking = false
) {
  return {
    code,
    classification,
    severity,
    message,
    path: normalizeFindingPath(findingPath),
    capabilityId,
    expected,
    observed,
    blocking
  };
}

function createLimitation(code, message, findingPath = null, capabilityId = null) {
  return {
    code,
    message,
    path: findingPath,
    capabilityId
  };
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isRepositoryRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) {
    return false;
  }

  if (
    value.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.includes("//")
  ) {
    return false;
  }

  const segments = value.split("/");
  return !segments.some(
    (segment) => segment === "" || segment === "." || segment === ".."
  );
}

  repoRoot,
  repositoryPath
) {
  if (!isRepositoryRelativePath(repositoryPath)) {
    throw new Error(
      `Unsafe repository-relative path: ${repositoryPath}`
    );
  }

  const absoluteRoot = path.resolve(repoRoot);
  const absolutePath = path.resolve(
    absoluteRoot,
    repositoryPath
  );

  const relative = path.relative(
    absoluteRoot,
    absolutePath
  );

  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Path escapes repository root: ${repositoryPath}`
    );
  }

  return {
    absoluteRoot,
    absolutePath,
    relative
  };
}

function assertRealRepositoryContainment(
  realRoot,
  realTarget,
  repositoryPath
) {
  const relative = path.relative(
    realRoot,
    realTarget
  );

  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Resolved path escapes repository root: ${repositoryPath}`
    );
  }
}

async function assertNoSymbolicLinkSegments({
  absoluteRoot,
  relative,
  repositoryPath
}) {
  const segments = relative.split(path.sep);

  let currentPath = absoluteRoot;

  for (const segment of segments) {
    currentPath = path.join(
      currentPath,
      segment
    );

    const stat = await lstat(currentPath);

    if (stat.isSymbolicLink()) {
      throw new Error(
        `Symbolic links are prohibited in repository evidence paths: ${repositoryPath}`
      );
    }
  }
}

async function resolveVerifiedRepositoryFile(
  repoRoot,
  repositoryPath
) {
  const {
    absoluteRoot,
    absolutePath,
    relative
  } = assertLexicalRepositoryContainment(
    repoRoot,
    repositoryPath
  );

  const realRoot = await realpath(
    absoluteRoot
  );

  const realTarget = await realpath(
    absolutePath
  );

  assertRealRepositoryContainment(
    realRoot,
    realTarget,
    repositoryPath
  );

  await assertNoSymbolicLinkSegments({
    absoluteRoot,
    relative,
    repositoryPath
  });

  const stat = await lstat(
    absolutePath
  );

  if (!stat.isFile()) {
    throw new Error(
      `Repository path is not a regular file: ${repositoryPath}`
    );
  }

  return absolutePath;
}

async function inspectRepositoryPath(
  repoRoot,
  repositoryPath
) {
  try {
    await resolveVerifiedRepositoryFile(
      repoRoot,
      repositoryPath
    );

    return {
      status: "PRESENT",
      reason: null
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        status: "MISSING",
        reason: "missing"
      };
    }

    const message =
      error instanceof Error
        ? error.message
        : "inspection_failed";

    if (
      /symbolic links? are prohibited/iu.test(
        message
      )
    ) {
      return {
        status: "MISMATCHED",
        reason: "symbolic_link"
      };
    }

    if (
      /resolved path escapes repository root/iu.test(
        message
      )
    ) {
      return {
        status: "MISMATCHED",
        reason: "resolved_path_escape"
      };
    }

    if (
      /not a regular file/iu.test(
        message
      )
    ) {
      return {
        status: "MISMATCHED",
        reason: "not_a_file"
      };
    }

    return {
      status: "MISMATCHED",
      reason: message
    };
  }
}

async function readJsonFile(
  repoRoot,
  repositoryPath
) {
  const absolutePath =
    await resolveVerifiedRepositoryFile(
      repoRoot,
      repositoryPath
    );

  const source = await readFile(
    absolutePath,
    "utf8"
  );

  return JSON.parse(source);
}

async function readTextFile(
  repoRoot,
  repositoryPath
) {
  const absolutePath =
    await resolveVerifiedRepositoryFile(
      repoRoot,
      repositoryPath
    );

  return readFile(
    absolutePath,
    "utf8"
  );
}

function validateTopLevelShape(manifest, errors) {
  const required = [
    "schemaVersion",
    "manifestVersion",
    "repository",
    "packageVersion",
    "architectureVersion",
    "authority",
    "highestSpecifiedMilestone",
    "highestImplementedMilestone",
    "highestSelfTestedMilestone",
    "highestLiveCertifiedMilestone",
    "overallStatus",
    "limitations",
    "capabilities"
  ];

  const allowed = new Set(required);

  if (!isPlainObject(manifest)) {
    errors.push(
      createError(
        "ERR_MANIFEST_NOT_OBJECT",
        "The canonical manifest must be a JSON object."
      )
    );
    return false;
  }

  for (const key of required) {
    if (!Object.hasOwn(manifest, key)) {
      errors.push(
        createError(
          "ERR_MANIFEST_REQUIRED_FIELD",
          `Missing required manifest field: ${key}.`,
          key
        )
      );
    }
  }

  for (const key of Object.keys(manifest)) {
    if (!allowed.has(key)) {
      errors.push(
        createError(
          "ERR_MANIFEST_UNKNOWN_FIELD",
          `Unknown manifest field: ${key}.`,
          key
        )
      );
    }
  }

  if (manifest.schemaVersion !== "1.0.0") {
    errors.push(
      createError(
        "ERR_SCHEMA_VERSION",
        "schemaVersion must be 1.0.0.",
        "schemaVersion"
      )
    );
  }

  if (manifest.repository !== "KAVEEP-DEV-AGENT") {
    errors.push(
      createError(
        "ERR_REPOSITORY_IDENTITY",
        "repository must be KAVEEP-DEV-AGENT.",
        "repository"
      )
    );
  }

  for (const field of [
    "manifestVersion",
    "packageVersion",
    "architectureVersion"
  ]) {
    if (!VERSION_PATTERN.test(manifest[field] ?? "")) {
      errors.push(
        createError(
          "ERR_VERSION_FORMAT",
          `${field} must use semantic version format X.Y.Z.`,
          field
        )
      );
    }
  }

  const milestoneFields = [
    "highestSpecifiedMilestone",
    "highestImplementedMilestone",
    "highestSelfTestedMilestone",
    "highestLiveCertifiedMilestone"
  ];

  for (const field of milestoneFields) {
    const value = manifest[field];
    if (value !== "UNVERIFIED" && !MILESTONE_PATTERN.test(value ?? "")) {
      errors.push(
        createError(
          "ERR_MILESTONE_FORMAT",
          `${field} must be SPEC-### or UNVERIFIED.`,
          field
        )
      );
    }
  }

  if (
    ![
      "VALID",
      "DRIFT_DETECTED",
      "UNVERIFIED",
      "BLOCKED",
      "DEPRECATED"
    ].includes(manifest.overallStatus)
  ) {
    errors.push(
      createError(
        "ERR_OVERALL_STATUS",
        "overallStatus contains an unsupported value.",
        "overallStatus"
      )
    );
  }

  if (!Array.isArray(manifest.authority) || manifest.authority.length === 0) {
    errors.push(
      createError(
        "ERR_AUTHORITY_LIST",
        "authority must be a non-empty array.",
        "authority"
      )
    );
  } else {
    const seen = new Set();
    for (const authorityPath of manifest.authority) {
      if (!AUTHORITY_PATHS.has(authorityPath)) {
        errors.push(
          createError(
            "ERR_AUTHORITY_PATH",
            `Unsupported authority path: ${authorityPath}.`,
            authorityPath
          )
        );
      }
      if (seen.has(authorityPath)) {
        errors.push(
          createError(
            "ERR_AUTHORITY_DUPLICATE",
            `Duplicate authority path: ${authorityPath}.`,
            authorityPath
          )
        );
      }
      seen.add(authorityPath);
    }
  }

  if (!Array.isArray(manifest.limitations)) {
    errors.push(
      createError(
        "ERR_LIMITATIONS_TYPE",
        "limitations must be an array.",
        "limitations"
      )
    );
  }

  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
    errors.push(
      createError(
        "ERR_CAPABILITIES_LIST",
        "capabilities must be a non-empty array.",
        "capabilities"
      )
    );
  }

  return errors.length === 0;
}

function validateEvidenceShape(evidence, errors, capabilityId, index) {
  const findingPath = `capabilities/${capabilityId}/evidence/${index}`;
  const required = new Set([
    "evidenceId",
    "evidenceType",
    "path",
    "claim",
    "status",
    "limitations"
  ]);
  const allowed = new Set([
    ...required,
    "contentSha256",
    "evidenceVersion",
    "runtime",
    "review",
    "production"
  ]);

  if (!isPlainObject(evidence)) {
    errors.push(
      createError(
        "ERR_EVIDENCE_NOT_OBJECT",
        "Evidence entries must be JSON objects.",
        findingPath,
        capabilityId
      )
    );
    return false;
  }

  for (const key of required) {
    if (!Object.hasOwn(evidence, key)) {
      errors.push(
        createError(
          "ERR_EVIDENCE_REQUIRED_FIELD",
          `Missing evidence field: ${key}.`,
          findingPath,
          capabilityId
        )
      );
    }
  }

  if (!hasOnlyKeys(evidence, allowed)) {
    errors.push(
      createError(
        "ERR_EVIDENCE_UNKNOWN_FIELD",
        "Evidence contains an unknown field.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!EVIDENCE_ID_PATTERN.test(evidence.evidenceId ?? "")) {
    errors.push(
      createError(
        "ERR_EVIDENCE_ID",
        "Evidence ID has an invalid format.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!EVIDENCE_TYPES.has(evidence.evidenceType)) {
    errors.push(
      createError(
        "ERR_EVIDENCE_TYPE",
        "Evidence type is unsupported.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!CAPABILITY_STATUSES.has(evidence.claim)) {
    errors.push(
      createError(
        "ERR_EVIDENCE_CLAIM",
        "Evidence claim is unsupported.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!EVIDENCE_STATUSES.has(evidence.status)) {
    errors.push(
      createError(
        "ERR_EVIDENCE_STATUS",
        "Evidence status is unsupported.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!isRepositoryRelativePath(evidence.path)) {
    errors.push(
      createError(
        "ERR_EVIDENCE_PATH",
        "Evidence path must be normalized and repository-relative.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!Array.isArray(evidence.limitations)) {
    errors.push(
      createError(
        "ERR_EVIDENCE_LIMITATIONS",
        "Evidence limitations must be an array.",
        findingPath,
        capabilityId
      )
    );
  }

  if (
    ["FAILED", "UNVERIFIED", "UNAVAILABLE", "EXPIRED", "BLOCKED"].includes(
      evidence.status
    ) &&
    (!Array.isArray(evidence.limitations) ||
      evidence.limitations.length === 0)
  ) {
    errors.push(
      createError(
        "ERR_EVIDENCE_LIMITATION_REQUIRED",
        "Non-success evidence must include at least one limitation.",
        findingPath,
        capabilityId
      )
    );
  }

  if (
    evidence.evidenceVersion !== undefined &&
    !VERSION_PATTERN.test(evidence.evidenceVersion)
  ) {
    errors.push(
      createError(
        "ERR_EVIDENCE_VERSION",
        "evidenceVersion must use semantic version format X.Y.Z.",
        findingPath,
        capabilityId
      )
    );
  }

  if (
    evidence.contentSha256 !== undefined &&
    !/^[a-f0-9]{64}$/.test(evidence.contentSha256)
  ) {
    errors.push(
      createError(
        "ERR_EVIDENCE_HASH",
        "contentSha256 must be a lowercase SHA-256 value.",
        findingPath,
        capabilityId
      )
    );
  }

  return true;
}

function validateCapabilityShape(capability, errors, index) {
  const fallbackId = `index-${index}`;
  const capabilityId =
    typeof capability?.capabilityId === "string"
      ? capability.capabilityId
      : fallbackId;
  const findingPath = `capabilities/${capabilityId}`;

  const required = new Set([
    "capabilityId",
    "name",
    "governingSpecification",
    "implementationPaths",
    "testPaths",
    "qualityGate",
    "capabilityStatus",
    "certificationStatus",
    "evidence",
    "limitations",
    "dependencies",
    "lastReviewedVersion"
  ]);

  if (!isPlainObject(capability)) {
    errors.push(
      createError(
        "ERR_CAPABILITY_NOT_OBJECT",
        "Capability entries must be JSON objects.",
        findingPath,
        capabilityId
      )
    );
    return capabilityId;
  }

  for (const key of required) {
    if (!Object.hasOwn(capability, key)) {
      errors.push(
        createError(
          "ERR_CAPABILITY_REQUIRED_FIELD",
          `Missing capability field: ${key}.`,
          findingPath,
          capabilityId
        )
      );
    }
  }

  if (!hasOnlyKeys(capability, required)) {
    errors.push(
      createError(
        "ERR_CAPABILITY_UNKNOWN_FIELD",
        "Capability contains an unknown field.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!CAPABILITY_ID_PATTERN.test(capability.capabilityId ?? "")) {
    errors.push(
      createError(
        "ERR_CAPABILITY_ID",
        "Capability ID has an invalid format.",
        findingPath,
        capabilityId
      )
    );
  }

  if (
    typeof capability.name !== "string" ||
    capability.name.length === 0 ||
    capability.name.length > 200
  ) {
    errors.push(
      createError(
        "ERR_CAPABILITY_NAME",
        "Capability name must be a non-empty string.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!SPEC_PATH_PATTERN.test(capability.governingSpecification ?? "")) {
    errors.push(
      createError(
        "ERR_SPECIFICATION_PATH",
        "governingSpecification must use specs/SPEC-###.md.",
        findingPath,
        capabilityId
      )
    );
  }

  for (const field of ["implementationPaths", "testPaths"]) {
    if (!Array.isArray(capability[field])) {
      errors.push(
        createError(
          "ERR_CAPABILITY_PATH_LIST",
          `${field} must be an array.`,
          findingPath,
          capabilityId
        )
      );
      continue;
    }

    const seen = new Set();
    for (const repositoryPath of capability[field]) {
      if (!isRepositoryRelativePath(repositoryPath)) {
        errors.push(
          createError(
            "ERR_CAPABILITY_PATH",
            `${field} contains an unsafe repository path.`,
            repositoryPath,
            capabilityId
          )
        );
      }
      if (seen.has(repositoryPath)) {
        errors.push(
          createError(
            "ERR_CAPABILITY_PATH_DUPLICATE",
            `${field} contains a duplicate path.`,
            repositoryPath,
            capabilityId
          )
        );
      }
      seen.add(repositoryPath);
    }
  }

  if (
    capability.qualityGate !== null &&
    !(
      isPlainObject(capability.qualityGate) &&
      typeof capability.qualityGate.name === "string" &&
      capability.qualityGate.name.length > 0 &&
      TEST_PATH_PATTERN.test(capability.qualityGate.testPath ?? "") &&
      hasOnlyKeys(capability.qualityGate, new Set(["name", "testPath"]))
    )
  ) {
    errors.push(
      createError(
        "ERR_QUALITY_GATE_SHAPE",
        "qualityGate must be null or contain only name and a tools/test-*.mjs testPath.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!CAPABILITY_STATUSES.has(capability.capabilityStatus)) {
    errors.push(
      createError(
        "ERR_CAPABILITY_STATUS",
        "Capability status is unsupported.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!CERTIFICATION_STATUSES.has(capability.certificationStatus)) {
    errors.push(
      createError(
        "ERR_CERTIFICATION_STATUS",
        "Certification status is unsupported.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!Array.isArray(capability.evidence)) {
    errors.push(
      createError(
        "ERR_EVIDENCE_LIST",
        "evidence must be an array.",
        findingPath,
        capabilityId
      )
    );
  } else {
    const evidenceIds = new Set();
    capability.evidence.forEach((evidence, evidenceIndex) => {
      validateEvidenceShape(evidence, errors, capabilityId, evidenceIndex);
      if (evidenceIds.has(evidence?.evidenceId)) {
        errors.push(
          createError(
            "ERR_EVIDENCE_ID_DUPLICATE",
            `Duplicate evidence ID: ${evidence?.evidenceId}.`,
            findingPath,
            capabilityId
          )
        );
      }
      evidenceIds.add(evidence?.evidenceId);
    });
  }

  if (!Array.isArray(capability.limitations)) {
    errors.push(
      createError(
        "ERR_CAPABILITY_LIMITATIONS",
        "Capability limitations must be an array.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!Array.isArray(capability.dependencies)) {
    errors.push(
      createError(
        "ERR_CAPABILITY_DEPENDENCIES",
        "Capability dependencies must be an array.",
        findingPath,
        capabilityId
      )
    );
  }

  if (!VERSION_PATTERN.test(capability.lastReviewedVersion ?? "")) {
    errors.push(
      createError(
        "ERR_REVIEWED_VERSION",
        "lastReviewedVersion must use semantic version format X.Y.Z.",
        findingPath,
        capabilityId
      )
    );
  }

  return capabilityId;
}

function hasSupportingEvidence(capability, evidenceType, claim, status) {
  return capability.evidence?.some(
    (entry) =>
      entry.evidenceType === evidenceType &&
      entry.claim === claim &&
      entry.status === status
  );
}

function validateStatusEvidence(capability, errors, drift) {
  const capabilityId = capability.capabilityId;
  const findingPath = `capabilities/${capabilityId}`;
  const status = capability.capabilityStatus;
  const certification = capability.certificationStatus;

  const requirements = new Map([
    ["SPECIFIED", ["SPECIFICATION", "SPECIFIED", "PRESENT"]],
    ["IMPLEMENTED", ["IMPLEMENTATION", "IMPLEMENTED", "PRESENT"]],
    ["SELF_TESTED", ["TEST", "SELF_TESTED", "PASSED"]],
    [
      "INTEGRATION_TESTED",
      ["INTEGRATION_RESULT", "INTEGRATION_TESTED", "PASSED"]
    ],
    ["LIVE_CERTIFIED", ["LIVE_CERTIFICATION", "LIVE_CERTIFIED", "PASSED"]],
    [
      "INDEPENDENTLY_REVIEWED",
      ["INDEPENDENT_REVIEW", "INDEPENDENTLY_REVIEWED", "PASSED"]
    ],
    [
      "PRODUCTION_PROVEN",
      ["PRODUCTION_RECORD", "PRODUCTION_PROVEN", "PASSED"]
    ]
  ]);

  if (requirements.has(status)) {
    const [evidenceType, claim, evidenceStatus] = requirements.get(status);
    if (!hasSupportingEvidence(capability, evidenceType, claim, evidenceStatus)) {
      errors.push(
        createError(
          "ERR_CAPABILITY_EVIDENCE_MISSING",
          `${status} requires ${evidenceType} evidence with claim ${claim} and status ${evidenceStatus}.`,
          findingPath,
          capabilityId
        )
      );
    }
  }

  if (requirements.has(certification)) {
    const [evidenceType, claim, evidenceStatus] =
      requirements.get(certification);
    if (!hasSupportingEvidence(capability, evidenceType, claim, evidenceStatus)) {
      errors.push(
        createError(
          "ERR_CERTIFICATION_EVIDENCE_MISSING",
          `${certification} certification requires matching passed evidence.`,
          findingPath,
          capabilityId
        )
      );
    }
  }

  if (
    ["BLOCKED", "UNVERIFIED"].includes(status) &&
    capability.limitations?.length === 0
  ) {
    errors.push(
      createError(
        "ERR_CAPABILITY_LIMITATION_REQUIRED",
        `${status} capability status requires a limitation.`,
        findingPath,
        capabilityId
      )
    );
  }

  if (
    ["FAILED", "UNVERIFIED", "BLOCKED", "EXPIRED"].includes(certification) &&
    capability.limitations?.length === 0
  ) {
    errors.push(
      createError(
        "ERR_CERTIFICATION_LIMITATION_REQUIRED",
        `${certification} certification status requires a limitation.`,
        findingPath,
        capabilityId
      )
    );
  }

  if (
    ["PROPOSED", "SPECIFIED"].includes(status) &&
    (capability.implementationPaths?.length > 0 ||
      capability.testPaths?.length > 0 ||
      capability.qualityGate !== null)
  ) {
    drift.push(
      createDrift(
        "DRIFT_PREIMPLEMENTATION_PATHS",
        "IMPLEMENTATION_DRIFT",
        "HIGH",
        `${status} capability must not claim implementation paths, tests, or a quality gate.`,
        findingPath,
        capabilityId,
        "No implementation, test, or quality-gate claim",
        "One or more pre-implementation claims are present",
        true
      )
    );
  }

  if (
    [
      "SELF_TESTED",
      "INTEGRATION_TESTED",
      "LIVE_CERTIFIED",
      "INDEPENDENTLY_REVIEWED",
      "PRODUCTION_PROVEN"
    ].includes(status) &&
    capability.testPaths?.length === 0
  ) {
    errors.push(
      createError(
        "ERR_TEST_PATH_REQUIRED",
        `${status} requires at least one test path.`,
        findingPath,
        capabilityId
      )
    );
  }
}

async function inspectCapabilityPaths(
  repoRoot,
  capability,
  errors,
  drift,
  evidenceInspected
) {
  const capabilityId = capability.capabilityId;

  const pathGroups = [
    ["governingSpecification", [capability.governingSpecification]],
    ["implementationPaths", capability.implementationPaths ?? []],
    ["testPaths", capability.testPaths ?? []]
  ];

  for (const [group, paths] of pathGroups) {
    for (const repositoryPath of paths) {
      if (!isRepositoryRelativePath(repositoryPath)) {
        continue;
      }

      const inspection = await inspectRepositoryPath(repoRoot, repositoryPath);
      if (inspection.status !== "PRESENT") {
        const classification =
          group === "governingSpecification"
            ? "SPECIFICATION_DRIFT"
            : group === "testPaths"
              ? "TEST_DRIFT"
              : "IMPLEMENTATION_DRIFT";

        drift.push(
          createDrift(
            `DRIFT_${group.toUpperCase()}_PATH`,
            classification,
            "HIGH",
            `${group} references a missing, non-file, unsafe, or symbolic-link path.`,
            repositoryPath,
            capabilityId,
            "PRESENT regular file",
            inspection.reason,
            true
          )
        );
      }
    }
  }

  for (const evidence of capability.evidence ?? []) {
    if (!isRepositoryRelativePath(evidence.path)) {
      continue;
    }

    const inspection = await inspectRepositoryPath(repoRoot, evidence.path);
    evidenceInspected.push({
      evidenceId: evidence.evidenceId,
      path: evidence.path,
      status: inspection.status
    });

    if (inspection.status !== "PRESENT") {
      drift.push(
        createDrift(
          "DRIFT_EVIDENCE_PATH",
          "EVIDENCE_DRIFT",
          "HIGH",
          "Evidence references a missing, non-file, unsafe, or symbolic-link path.",
          evidence.path,
          capabilityId,
          "PRESENT regular file",
          inspection.reason,
          true
        )
      );
    }
  }

  if (capability.qualityGate !== null) {
    const gateTestPath = capability.qualityGate.testPath;
    if (!capability.testPaths.includes(gateTestPath)) {
      errors.push(
        createError(
          "ERR_QUALITY_GATE_TEST_CORRELATION",
          "qualityGate.testPath must also appear in testPaths.",
          gateTestPath,
          capabilityId
        )
      );
    }

    const testInspection = await inspectRepositoryPath(repoRoot, gateTestPath);
    if (testInspection.status !== "PRESENT") {
      drift.push(
        createDrift(
          "DRIFT_QUALITY_GATE_TEST_PATH",
          "QUALITY_GATE_DRIFT",
          "HIGH",
          "The quality gate references a missing or invalid test path.",
          gateTestPath,
          capabilityId,
          "PRESENT regular file",
          testInspection.reason,
          true
        )
      );
    }
  }
}

function parseArchitectureVersion(source) {
  const match = source.match(
    /(?:^|\n)Version\s*(?:\r?\n)+\s*([0-9]+\.[0-9]+\.[0-9]+)\s*(?:\r?\n|$)/i
  );
  return match?.[1] ?? null;
}

function qualityGateIsRegistered(source, qualityGate) {
  const escapedName = qualityGate.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedPath = qualityGate.testPath.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
  const pattern = new RegExp(
    `["'\`]${escapedName}["'\`][\\s\\S]{0,300}["'\`]${escapedPath}["'\`]`
  );
  return pattern.test(source);
}

function milestoneToSpecPath(milestone) {
  return `specs/${milestone}.md`;
}

function milestoneNumber(value) {
  return value === "UNVERIFIED"
    ? null
    : Number.parseInt(value.slice("SPEC-".length), 10);
}

function validateMilestoneOrdering(manifest, drift) {
  const specified = milestoneNumber(manifest.highestSpecifiedMilestone);
  const implemented = milestoneNumber(manifest.highestImplementedMilestone);
  const selfTested = milestoneNumber(manifest.highestSelfTestedMilestone);
  const liveCertified = milestoneNumber(manifest.highestLiveCertifiedMilestone);

  const comparisons = [
    ["highestImplementedMilestone", implemented, specified],
    ["highestSelfTestedMilestone", selfTested, implemented],
    ["highestLiveCertifiedMilestone", liveCertified, selfTested]
  ];

  for (const [field, current, upperBound] of comparisons) {
    if (current !== null && upperBound !== null && current > upperBound) {
      drift.push(
        createDrift(
          "DRIFT_MILESTONE_ORDER",
          "MANIFEST_DRIFT",
          "HIGH",
          `${field} exceeds the preceding evidence tier.`,
          field,
          null,
          `At most ${upperBound}`,
          current,
          true
        )
      );
    }
  }
}

async function validateRepositoryMetadata(repoRoot, manifest, errors, drift) {
  try {
    const packageJson = await readJsonFile(repoRoot, PACKAGE_PATH);
    if (packageJson.version !== manifest.packageVersion) {
      drift.push(
        createDrift(
          "DRIFT_PACKAGE_VERSION",
          "VERSION_DRIFT",
          "HIGH",
          "Manifest packageVersion does not match package.json.",
          PACKAGE_PATH,
          null,
          packageJson.version ?? null,
          manifest.packageVersion,
          true
        )
      );
    }
  } catch (error) {
    errors.push(
      createError(
        "ERR_PACKAGE_READ",
        `Unable to read package.json: ${error.message}.`,
        PACKAGE_PATH
      )
    );
  }

  try {
    const architectureSource = await readTextFile(repoRoot, ARCHITECTURE_PATH);
    const architectureVersion = parseArchitectureVersion(architectureSource);

    if (architectureVersion === null) {
      drift.push(
        createDrift(
          "DRIFT_ARCHITECTURE_VERSION_MISSING",
          "VERSION_DRIFT",
          "HIGH",
          "ARCHITECTURE.md does not expose a deterministic semantic version.",
          ARCHITECTURE_PATH,
          null,
          manifest.architectureVersion,
          null,
          true
        )
      );
    } else if (architectureVersion !== manifest.architectureVersion) {
      drift.push(
        createDrift(
          "DRIFT_ARCHITECTURE_VERSION",
          "VERSION_DRIFT",
          "HIGH",
          "Manifest architectureVersion does not match ARCHITECTURE.md.",
          ARCHITECTURE_PATH,
          null,
          architectureVersion,
          manifest.architectureVersion,
          true
        )
      );
    }
  } catch (error) {
    errors.push(
      createError(
        "ERR_ARCHITECTURE_READ",
        `Unable to read ARCHITECTURE.md: ${error.message}.`,
        ARCHITECTURE_PATH
      )
    );
  }

  for (const authorityPath of manifest.authority ?? []) {
    const inspection = await inspectRepositoryPath(repoRoot, authorityPath);
    if (inspection.status !== "PRESENT") {
      drift.push(
        createDrift(
          "DRIFT_AUTHORITY_PATH",
          "AUTHORITY_DRIFT",
          "CRITICAL",
          "Manifest authority references a missing or unsafe file.",
          authorityPath,
          null,
          "PRESENT regular file",
          inspection.reason,
          true
        )
      );
    }
  }
}

async function validateQualityGates(repoRoot, manifest, errors, drift) {
  const capabilitiesWithGates = (manifest.capabilities ?? []).filter(
    (capability) => capability.qualityGate !== null
  );

  if (capabilitiesWithGates.length === 0) {
    return;
  }

  let source;
  try {
    source = await readTextFile(repoRoot, QUALITY_GATES_PATH);
  } catch (error) {
    errors.push(
      createError(
        "ERR_QUALITY_GATES_READ",
        `Unable to read quality-gate registry: ${error.message}.`,
        QUALITY_GATES_PATH
      )
    );
    return;
  }

  const gateNames = new Set();
  const gatePaths = new Set();

  for (const capability of capabilitiesWithGates) {
    const { qualityGate, capabilityId } = capability;

    if (gateNames.has(qualityGate.name) || gatePaths.has(qualityGate.testPath)) {
      drift.push(
        createDrift(
          "DRIFT_QUALITY_GATE_DUPLICATE",
          "QUALITY_GATE_DRIFT",
          "HIGH",
          "Quality-gate names and test paths must be unique in the manifest.",
          qualityGate.testPath,
          capabilityId,
          "Unique quality gate",
          qualityGate.name,
          true
        )
      );
    }

    gateNames.add(qualityGate.name);
    gatePaths.add(qualityGate.testPath);

    if (!qualityGateIsRegistered(source, qualityGate)) {
      drift.push(
        createDrift(
          "DRIFT_QUALITY_GATE_REGISTRATION",
          "QUALITY_GATE_DRIFT",
          "HIGH",
          "Claimed quality gate is not registered with the declared name and test path.",
          QUALITY_GATES_PATH,
          capabilityId,
          `${qualityGate.name} -> ${qualityGate.testPath}`,
          "Not found",
          true
        )
      );
    }
  }
}

async function validateMilestoneClaims(repoRoot, manifest, drift) {
  for (const field of [
    "highestSpecifiedMilestone",
    "highestImplementedMilestone",
    "highestSelfTestedMilestone",
    "highestLiveCertifiedMilestone"
  ]) {
    const milestone = manifest[field];
    if (milestone === "UNVERIFIED") {
      continue;
    }

    const specPath = milestoneToSpecPath(milestone);
    const inspection = await inspectRepositoryPath(repoRoot, specPath);

    if (inspection.status !== "PRESENT") {
      drift.push(
        createDrift(
          "DRIFT_MILESTONE_SPECIFICATION",
          "SPECIFICATION_DRIFT",
          "HIGH",
          `${field} references a milestone without an existing specification.`,
          specPath,
          null,
          "PRESENT regular file",
          inspection.reason,
          true
        )
      );
    }

    const supportingCapabilities = (manifest.capabilities ?? []).filter(
      (capability) => capability.governingSpecification === specPath
    );

    if (supportingCapabilities.length === 0) {
      drift.push(
        createDrift(
          "DRIFT_MILESTONE_CAPABILITY",
          "MANIFEST_DRIFT",
          "HIGH",
          `${field} has no capability entry governed by its milestone specification.`,
          field,
          null,
          specPath,
          "No matching capability",
          true
        )
      );
      continue;
    }

    const supported =
      field === "highestSpecifiedMilestone"
        ? supportingCapabilities.some((capability) =>
            [
              "SPECIFIED",
              "IMPLEMENTED",
              "SELF_TESTED",
              "INTEGRATION_TESTED",
              "LIVE_CERTIFIED",
              "INDEPENDENTLY_REVIEWED",
              "PRODUCTION_PROVEN"
            ].includes(capability.capabilityStatus)
          )
        : field === "highestImplementedMilestone"
          ? supportingCapabilities.some((capability) =>
              [
                "IMPLEMENTED",
                "SELF_TESTED",
                "INTEGRATION_TESTED",
                "LIVE_CERTIFIED",
                "INDEPENDENTLY_REVIEWED",
                "PRODUCTION_PROVEN"
              ].includes(capability.capabilityStatus)
            )
          : field === "highestSelfTestedMilestone"
            ? supportingCapabilities.some((capability) =>
                [
                  "SELF_TESTED",
                  "INTEGRATION_TESTED",
                  "LIVE_CERTIFIED",
                  "INDEPENDENTLY_REVIEWED",
                  "PRODUCTION_PROVEN"
                ].includes(capability.capabilityStatus)
              )
            : supportingCapabilities.some(
                (capability) =>
                  capability.capabilityStatus === "LIVE_CERTIFIED" &&
                  capability.certificationStatus === "LIVE_CERTIFIED"
              );

    if (!supported) {
      drift.push(
        createDrift(
          "DRIFT_MILESTONE_EVIDENCE",
          "MANIFEST_DRIFT",
          "HIGH",
          `${field} exceeds the status supported by its capability entries.`,
          field,
          null,
          milestone,
          "Insufficient capability evidence",
          true
        )
      );
    }
  }

  validateMilestoneOrdering(manifest, drift);
}

function determineResultStatus(errors, drift, manifest) {
  if (errors.length > 0) {
    return "INVALID";
  }

  if (drift.length > 0) {
    return "DRIFT_DETECTED";
  }

  if (
    manifest.overallStatus === "UNVERIFIED" ||
    [
      manifest.highestSpecifiedMilestone,
      manifest.highestImplementedMilestone,
      manifest.highestSelfTestedMilestone,
      manifest.highestLiveCertifiedMilestone
    ].includes("UNVERIFIED")
  ) {
    return "UNVERIFIED";
  }

  return "VALID";
}

export async function validateCapabilityManifest({
  repoRoot,
  manifest = null
}) {
  if (typeof repoRoot !== "string" || repoRoot.length === 0) {
    throw new TypeError("repoRoot must be a non-empty string.");
  }

  const errors = [];
  const drift = [];
  const limitations = [];
  const evidenceInspected = [];
  const capabilitiesInspected = [];

  let loadedManifest = manifest;

  if (loadedManifest === null) {
    try {
      loadedManifest = await readJsonFile(repoRoot, MANIFEST_PATH);
    } catch (error) {
      return {
        schemaVersion: "1.0.0",
        status: "INVALID",
        repository: "KAVEEP-DEV-AGENT",
        manifestPath: MANIFEST_PATH,
        errors: [
          createError(
            "ERR_MANIFEST_READ",
            `Unable to read canonical manifest: ${error.message}.`,
            MANIFEST_PATH
          )
        ],
        drift: [],
        limitations: [],
        evidenceInspected: [],
        capabilitiesInspected: [],
        blocking: true
      };
    }
  }

  const topLevelValid = validateTopLevelShape(loadedManifest, errors);

  if (topLevelValid) {
    const capabilityIds = new Set();

    loadedManifest.capabilities.forEach((capability, index) => {
      const capabilityId = validateCapabilityShape(
        capability,
        errors,
        index
      );

      if (capabilityIds.has(capabilityId)) {
        errors.push(
          createError(
            "ERR_CAPABILITY_ID_DUPLICATE",
            `Duplicate capability ID: ${capabilityId}.`,
            `capabilities/${capabilityId}`,
            capabilityId
          )
        );
      }
      capabilityIds.add(capabilityId);
    });

    for (const capability of loadedManifest.capabilities) {
      if (!isPlainObject(capability)) {
        continue;
      }

      validateStatusEvidence(capability, errors, drift);
      await inspectCapabilityPaths(
        repoRoot,
        capability,
        errors,
        drift,
        evidenceInspected
      );

      capabilitiesInspected.push({
        capabilityId: capability.capabilityId,
        capabilityStatus: capability.capabilityStatus,
        certificationStatus: capability.certificationStatus,
        valid: !errors.some(
          (finding) => finding.capabilityId === capability.capabilityId
        )
      });
    }

    for (const capability of loadedManifest.capabilities) {
      for (const dependency of capability.dependencies ?? []) {
        if (!capabilityIds.has(dependency)) {
          drift.push(
            createDrift(
              "DRIFT_CAPABILITY_DEPENDENCY",
              "MANIFEST_DRIFT",
              "HIGH",
              "Capability dependency is not present in the manifest.",
              `capabilities/${capability.capabilityId}`,
              capability.capabilityId,
              dependency,
              "Missing",
              true
            )
          );
        }

        if (dependency === capability.capabilityId) {
          errors.push(
            createError(
              "ERR_CAPABILITY_SELF_DEPENDENCY",
              "A capability must not depend on itself.",
              `capabilities/${capability.capabilityId}`,
              capability.capabilityId
            )
          );
        }
      }
    }

    await validateRepositoryMetadata(
      repoRoot,
      loadedManifest,
      errors,
      drift
    );
    await validateQualityGates(repoRoot, loadedManifest, errors, drift);
    await validateMilestoneClaims(repoRoot, loadedManifest, drift);

    if (
      loadedManifest.overallStatus !== "VALID" &&
      loadedManifest.limitations.length === 0
    ) {
      errors.push(
        createError(
          "ERR_MANIFEST_LIMITATION_REQUIRED",
          `${loadedManifest.overallStatus} overall status requires at least one limitation.`,
          "limitations"
        )
      );
    }

    loadedManifest.limitations.forEach((message, index) => {
      limitations.push(
        createLimitation(
          `LIMIT_MANIFEST_${String(index + 1).padStart(3, "0")}`,
          message
        )
      );
    });

    for (const capability of loadedManifest.capabilities) {
      capability.limitations.forEach((message, index) => {
        limitations.push(
          createLimitation(
            `LIMIT_CAPABILITY_${String(index + 1).padStart(3, "0")}`,
            message,
            `capabilities/${capability.capabilityId}`,
            capability.capabilityId
          )
        );
      });
    }
  }

  errors.sort(stableCompare);
  drift.sort(stableCompare);
  limitations.sort(stableCompare);
  evidenceInspected.sort(stableCompare);
  capabilitiesInspected.sort(stableCompare);

  const status = determineResultStatus(errors, drift, loadedManifest);
  const blocking =
    errors.length > 0 || drift.some((finding) => finding.blocking);

  return {
    schemaVersion: "1.0.0",
    status,
    repository: "KAVEEP-DEV-AGENT",
    manifestPath: MANIFEST_PATH,
    errors,
    drift,
    limitations,
    evidenceInspected,
    capabilitiesInspected,
    blocking
  };
}
