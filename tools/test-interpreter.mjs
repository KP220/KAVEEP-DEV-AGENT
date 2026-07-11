import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { interpretEngineeringCommand } from "../src/interpreter/thai-command-interpreter.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");

const schema = JSON.parse(
  await readFile(path.join(repoRoot, "schemas", "engineering-request.schema.json"), "utf8")
);

function validateRequestShape(request) {
  for (const key of schema.required) {
    assert.ok(Object.prototype.hasOwnProperty.call(request, key), `missing ${key}`);
  }
  assert.ok(schema.properties.status.enum.includes(request.status), "invalid status");
  assert.ok(schema.properties.taskType.enum.includes(request.taskType), "invalid taskType");
  assert.equal(request.requestedAutonomyLevel, "interpret_only");
  assert.notEqual(request.status, "approved");
  assert.notEqual(request.status, "executed");
}

const thaiRepo = interpretEngineeringCommand("ตรวจ Repository นี้และสร้างแผนเพิ่ม Schema โดยห้ามแก้ไฟล์จริงจนกว่าจะได้รับอนุมัติ");
validateRequestShape(thaiRepo);
assert.equal(thaiRepo.taskType, "schema_creation");
assert.equal(thaiRepo.status, "ready_for_planning");
assert.equal(thaiRepo.approvalLikelyRequired, true);

const thaiSchema = interpretEngineeringCommand("สร้าง schema ใหม่สำหรับ Engineering Decision");
validateRequestShape(thaiSchema);
assert.equal(thaiSchema.taskType, "schema_creation");
assert.ok(thaiSchema.requestedActions.includes("create"));

const protectedRequest = interpretEngineeringCommand("ลบไฟล์เก่าแล้ว merge เข้า main");
validateRequestShape(protectedRequest);
assert.equal(protectedRequest.status, "blocked");
assert.equal(protectedRequest.recommendedNextAction, "block_protected_action");
assert.ok(protectedRequest.preliminaryRiskIndicators.some((risk) => risk.category === "delete"));
assert.ok(protectedRequest.preliminaryRiskIndicators.some((risk) => risk.category === "merge"));

const emptyRequest = interpretEngineeringCommand("");
validateRequestShape(emptyRequest);
assert.equal(emptyRequest.status, "no_action");
assert.ok(emptyRequest.detectedAmbiguities.length > 0);

const ambiguousRequest = interpretEngineeringCommand("ช่วยดูหน่อย");
validateRequestShape(ambiguousRequest);
assert.equal(ambiguousRequest.status, "needs_clarification");
assert.equal(ambiguousRequest.taskType, "unknown");

const englishRequest = interpretEngineeringCommand("Review this repository and design a validation plan");
validateRequestShape(englishRequest);
assert.equal(englishRequest.language, "english");
assert.equal(englishRequest.status, "ready_for_planning");

console.log("PASSED interpreter tests");
