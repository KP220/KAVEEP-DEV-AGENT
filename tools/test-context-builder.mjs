import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildEngineeringContext } from "../src/context/context-builder.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const schemaPath = path.join(repoRoot, "schemas", "engineering-context.schema.json");

function request(overrides = {}) {
  return {
    requestId: "request_context_test_001",
    schemaVersion: "1.0.0",
    language: "english",
    originalCommand: "Create a new schema in this repository",
    normalizedCommand: "Create a new schema in this repository",
    requestSummary: "Create a schema",
    interpretedIntent: "Prepare schema creation request for planning.",
    taskType: "schema_creation",
    targetRepositories: ["current_repository"],
    targetFiles: [],
    targetComponents: ["schemas"],
    requestedActions: ["create"],
    constraints: ["No execution."],
    acceptanceCriteria: [],
    assumptions: [],
    detectedAmbiguities: [],
    missingContext: [],
    preliminaryRiskIndicators: [],
    requestedAutonomyLevel: "interpret_only",
    approvalLikelyRequired: false,
    planningReadiness: "ready",
    status: "ready_for_planning",
    recommendedNextAction: "send_to_planning",
    createdAt: "1970-01-01T00:00:00.000Z",
    ...overrides
  };
}

function intelligence(overrides = {}) {
  const files = [
    "README.md",
    "docs/ARCHITECTURE.md",
    "docs/MODULE-CONTRACTS.md",
    "examples/engineering-plan.example.json",
    "schemas/engineering-plan.schema.json",
    "specs/SPEC-003.md",
    "src/planning/planning-engine.mjs",
    "tools/test-planning-engine.mjs",
    "tools/validate-examples.mjs"
  ];
  return {
    intelligenceId: "repo_intel_context_test_001",
    repositoryRoot: "C:/work/KAVEEP-DEV-AGENT",
    status: "completed",
    directorySummary: { directories: ["docs", "examples", "schemas", "specs", "src", "tools"] },
    fileSummary: { files },
    detectedArtifacts: [],
    documentationArtifacts: [
      { path: "README.md", kind: "readme", confidence: "detected" },
      { path: "docs/ARCHITECTURE.md", kind: "architecture", confidence: "detected" },
      { path: "docs/MODULE-CONTRACTS.md", kind: "documentation", confidence: "detected" }
    ],
    specificationArtifacts: [
      { path: "specs", kind: "specification_directory", confidence: "detected" },
      { path: "specs/SPEC-003.md", kind: "specification", confidence: "detected" }
    ],
    schemaArtifacts: [
      { path: "schemas", kind: "schema_directory", confidence: "detected" },
      { path: "schemas/engineering-plan.schema.json", kind: "schema", confidence: "detected" }
    ],
    sourceArtifacts: [{ path: "src/planning/planning-engine.mjs", kind: "source", confidence: "detected" }],
    testArtifacts: [{ path: "tools/test-planning-engine.mjs", kind: "test", confidence: "detected" }],
    validationEntryPoints: [
      { entryType: "package_script", path: "tools/validate-examples.mjs", description: "npm run validate:examples", executed: false }
    ],
    packageAndBuildFiles: [{ path: "package.json", kind: "package_manifest", confidence: "detected" }],
    architectureSignals: [
      { signalType: "architecture_document", path: "docs/ARCHITECTURE.md", observation: "Architecture document detected." }
    ],
    ownershipSignals: [
      { signalType: "ownership_document", path: "docs/MODULE-CONTRACTS.md", observation: "Ownership document detected." }
    ],
    integrationSignals: [],
    relevantFiles: files,
    ignoredPaths: [{ path: ".git", reason: "Ignored by policy." }],
    warnings: [],
    evidenceRefs: [],
    ...overrides
  };
}

async function assertSchemaValid(value) {
  const schema = await loadSchema(schemaPath);
  const errors = [];
  await validateValue(value, schema, { schemaPath, rootSchema: schema }, "$", errors);
  assert.deepEqual(errors, []);
}

const first = buildEngineeringContext(request(), intelligence());
const second = buildEngineeringContext(request(), intelligence());
assert.deepEqual(first, second);
assert.equal(first.status, "completed");
assert(first.relevantSchemas.some((item) => item.path === "schemas/engineering-plan.schema.json"));
assert(first.relevantExamples.some((item) => item.path === "examples/engineering-plan.example.json"));
assert(!first.relevantFiles.some((item) => item.path === "schemas" || item.path === "specs"));
assert(first.relevantValidationEntryPoints.every((entry) => entry.executed === false));
await assertSchemaValid(first);

const missing = buildEngineeringContext(
  request({ targetFiles: ["schemas/missing.schema.json"] }),
  intelligence({ schemaArtifacts: [], specificationArtifacts: [], validationEntryPoints: [] })
);
assert.equal(missing.status, "completed_with_warnings");
assert(missing.missingContext.some((item) => item.includes("explicit target file not observed")));
await assertSchemaValid(missing);

const unsupported = buildEngineeringContext(request({ status: "unsupported" }), intelligence());
assert.equal(unsupported.status, "unsupported");
await assertSchemaValid(unsupported);

const empty = buildEngineeringContext(
  request({ originalCommand: "", normalizedCommand: "", status: "no_action" }),
  intelligence()
);
assert.equal(empty.status, "no_action");
await assertSchemaValid(empty);

const noIntelligence = buildEngineeringContext(request(), undefined);
assert.equal(noIntelligence.status, "needs_context");
await assertSchemaValid(noIntelligence);

const invalid = { ...first, status: "executed" };
const schema = await loadSchema(schemaPath);
const errors = [];
await validateValue(invalid, schema, { schemaPath, rootSchema: schema }, "$", errors);
assert(errors.length > 0);

assert.throws(() => buildEngineeringContext(undefined, intelligence()), /Engineering Request object is required/);

console.log("PASSED context builder tests");
