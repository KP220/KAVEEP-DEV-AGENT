import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { interpretEngineeringCommand } from "../src/interpreter/thai-command-interpreter.mjs";
import { createEngineeringPlan } from "../src/planning/planning-engine.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const schemaPath = path.join(repoRoot, "schemas", "engineering-plan.schema.json");
const planSchema = await loadSchema(schemaPath);

async function assertValidPlan(plan) {
  const errors = [];
  await validateValue(
    plan,
    planSchema,
    { schemaPath, rootSchema: planSchema },
    "$",
    errors
  );
  assert.deepEqual(errors, []);
}

async function assertInvalidPlan(plan) {
  const errors = [];
  await validateValue(
    plan,
    planSchema,
    { schemaPath, rootSchema: planSchema },
    "$",
    errors
  );
  assert.ok(errors.length > 0, "expected invalid plan to fail schema validation");
}

const repositoryRequest = interpretEngineeringCommand("ตรวจ Repository นี้และสร้างรายงาน");
const repositoryPlan = createEngineeringPlan(repositoryRequest);
await assertValidPlan(repositoryPlan);
assert.ok(repositoryPlan.steps.length > 0);
assert.equal(repositoryPlan.safety.planAuthorizesExecution, false);

const schemaRequest = interpretEngineeringCommand("สร้าง schema ใหม่สำหรับ Engineering Decision");
const schemaPlan = createEngineeringPlan(schemaRequest);
await assertValidPlan(schemaPlan);
assert.ok(schemaPlan.steps.some((step) => step.actionType === "design"));
assert.ok(schemaPlan.steps.some((step) => step.actionType === "validate"));
assert.ok(schemaPlan.steps.some((step) => step.actionType === "document"));

const protectedRequest = interpretEngineeringCommand("ลบไฟล์เก่าแล้ว merge เข้า main");
const protectedPlan = createEngineeringPlan(protectedRequest);
await assertValidPlan(protectedPlan);
assert.equal(protectedPlan.executionReadiness, "blocked");
assert.equal(protectedPlan.safety.planAuthorizesExecution, false);
assert.ok(protectedPlan.safety.protectedActions.includes("destructive_action"));
assert.ok(protectedPlan.safety.protectedActions.includes("merge"));

const clarificationRequest = interpretEngineeringCommand("ช่วยดูหน่อย");
const clarificationPlan = createEngineeringPlan(clarificationRequest);
await assertValidPlan(clarificationPlan);
assert.equal(clarificationPlan.status, "waiting_for_evidence");
assert.ok(clarificationPlan.steps.every((step) => step.actionType !== "modify"));

const unverifiedRequest = {
  ...interpretEngineeringCommand("ตรวจ Repository นี้"),
  status: "unverified",
  planningReadiness: "unverified"
};
const unverifiedPlan = createEngineeringPlan(unverifiedRequest);
await assertValidPlan(unverifiedPlan);
assert.equal(unverifiedPlan.status, "unverified");
assert.equal(unverifiedPlan.executionReadiness, "unverified");

const noActionRequest = interpretEngineeringCommand("");
const noActionPlan = createEngineeringPlan(noActionRequest);
await assertValidPlan(noActionPlan);
assert.equal(noActionPlan.status, "no_action");
assert.equal(noActionPlan.steps.length, 0);

assert.throws(() => createEngineeringPlan(null), /Engineering Request object is required/);

const englishRequest = interpretEngineeringCommand("Review this repository and design a validation plan");
const englishPlan = createEngineeringPlan(englishRequest);
await assertValidPlan(englishPlan);
assert.equal(englishPlan.safety.planAuthorizesExecution, false);

const repositoryContextPlan = createEngineeringPlan(schemaRequest, {
  repositoryIntelligence: {
    intelligenceId: "repo_intel_context_001",
    summary: "Observed repository context without executing code.",
    relevantFiles: ["schemas/engineering-plan.schema.json", "src/planning/planning-engine.mjs"]
  }
});
await assertValidPlan(repositoryContextPlan);
assert.deepEqual(repositoryContextPlan.repositoryIntelligenceRefs, ["repo_intel_context_001"]);
assert.equal(repositoryContextPlan.repositoryContextSummary, "Observed repository context without executing code.");
assert.ok(repositoryContextPlan.relevantFileRefs.includes("src/planning/planning-engine.mjs"));
assert.equal(repositoryContextPlan.safety.planAuthorizesExecution, false);

const engineeringContextPlan = createEngineeringPlan(schemaRequest, {
  repositoryIntelligence: {
    intelligenceId: "repo_intel_should_not_be_selected_001",
    summary: "Direct Repository Intelligence context should be superseded.",
    relevantFiles: ["README.md"]
  },
  engineeringContext: {
    contextId: "context_planning_001",
    repositoryIntelligenceRef: "repo_intel_context_001",
    relevantFiles: [
      { path: "schemas/context.schema.json", relevanceReason: "Selected schema", sourceField: "schemaArtifacts" },
      { path: "tools/test-context-builder.mjs", relevanceReason: "Selected test", sourceField: "testArtifacts" }
    ],
    missingContext: []
  }
});
await assertValidPlan(engineeringContextPlan);
assert.equal(engineeringContextPlan.engineeringContextRef, "context_planning_001");
assert.deepEqual(engineeringContextPlan.repositoryIntelligenceRefs, ["repo_intel_context_001"]);
assert.deepEqual(engineeringContextPlan.relevantFileRefs, ["schemas/context.schema.json", "tools/test-context-builder.mjs"]);
assert.match(engineeringContextPlan.repositoryContextSummary, /selected 2 relevant repository artifacts/);
assert.equal(engineeringContextPlan.safety.planAuthorizesExecution, false);

const invalidGeneratedPlan = {
  ...schemaPlan,
  safety: {
    ...schemaPlan.safety,
    planAuthorizesExecution: true
  }
};
await assertInvalidPlan(invalidGeneratedPlan);

console.log("PASSED planning engine tests");
