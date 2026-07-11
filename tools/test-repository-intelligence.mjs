import assert from "node:assert/strict";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectRepository } from "../src/repository/repository-intelligence.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const tempRoot = path.join(repoRoot, ".repository-intelligence-test-temp");
const schemaPath = path.join(repoRoot, "schemas", "repository-intelligence.schema.json");
const schema = await loadSchema(schemaPath);

async function assertValidReport(report) {
  const errors = [];
  await validateValue(report, schema, { schemaPath, rootSchema: schema }, "$", errors);
  assert.deepEqual(errors, []);
}

async function assertInvalidReport(report) {
  const errors = [];
  await validateValue(report, schema, { schemaPath, rootSchema: schema }, "$", errors);
  assert.ok(errors.length > 0, "expected invalid Repository Intelligence report to fail validation");
}

async function resetTempRoot() {
  await rm(tempRoot, { recursive: true, force: true });
  await mkdir(tempRoot, { recursive: true });
}

try {
  await resetTempRoot();
  await mkdir(path.join(tempRoot, "src"), { recursive: true });
  await mkdir(path.join(tempRoot, "docs"), { recursive: true });
  await mkdir(path.join(tempRoot, "schemas"), { recursive: true });
  await mkdir(path.join(tempRoot, "tests"), { recursive: true });
  await mkdir(path.join(tempRoot, "node_modules", "left-pad"), { recursive: true });
  await writeFile(path.join(tempRoot, "README.md"), "# Fixture\n", "utf8");
  await writeFile(path.join(tempRoot, "ARCHITECTURE.md"), "# Architecture\n", "utf8");
  await writeFile(path.join(tempRoot, "package.json"), JSON.stringify({ scripts: { test: "node tests/example.test.mjs", validate: "node validate.mjs" } }), "utf8");
  await writeFile(path.join(tempRoot, "src", "index.mjs"), "export const value = 1;\n", "utf8");
  await writeFile(path.join(tempRoot, "tests", "example.test.mjs"), "export const testName = 'example';\n", "utf8");
  await writeFile(path.join(tempRoot, "schemas", "thing.schema.json"), "{}", "utf8");
  await writeFile(path.join(tempRoot, ".env"), "SECRET_SHOULD_NOT_APPEAR=hidden\n", "utf8");
  await writeFile(path.join(tempRoot, "node_modules", "left-pad", "index.js"), "module.exports = 1;\n", "utf8");

  const validReport = await inspectRepository(tempRoot);
  await assertValidReport(validReport);
  assert.ok(["completed", "completed_with_warnings"].includes(validReport.status));
  assert.ok(validReport.detectedArtifacts.some((artifact) => artifact.path === "README.md"));
  assert.ok(validReport.technologyIndicators.some((indicator) => indicator.technology === "Node.js"));
  assert.ok(validReport.validationEntryPoints.some((entry) => entry.entryType === "package_script" && entry.executed === false));
  assert.ok(validReport.ignoredPaths.some((entry) => entry.path === "node_modules"));
  assert.ok(!JSON.stringify(validReport).includes("SECRET_SHOULD_NOT_APPEAR"));
  assert.ok(validReport.warnings.some((warning) => warning.code === "sensitive_artifact_detected"));

  const missingReport = await inspectRepository(path.join(tempRoot, "missing"));
  await assertValidReport(missingReport);
  assert.equal(missingReport.status, "blocked");

  const fileReport = await inspectRepository(path.join(tempRoot, "README.md"));
  await assertValidReport(fileReport);
  assert.equal(fileReport.status, "blocked");

  const noRootReport = await inspectRepository("");
  await assertValidReport(noRootReport);
  assert.equal(noRootReport.status, "no_action");

  const escapeReport = await inspectRepository(path.join(tempRoot, "..", "..", "definitely-missing-repo"));
  await assertValidReport(escapeReport);
  assert.equal(escapeReport.status, "blocked");

  await resetTempRoot();
  await mkdir(path.join(tempRoot, "many"), { recursive: true });
  await writeFile(path.join(tempRoot, "README.md"), "# Bounds\n", "utf8");
  await writeFile(path.join(tempRoot, "many", "one.js"), "export const one = 1;\n", "utf8");
  await writeFile(path.join(tempRoot, "many", "two.js"), "export const two = 2;\n", "utf8");
  const boundedReport = await inspectRepository(tempRoot, { maxFiles: 1 });
  await assertValidReport(boundedReport);
  assert.equal(boundedReport.status, "completed_with_warnings");
  assert.ok(boundedReport.warnings.some((warning) => warning.code === "max_files_reached"));

  let symlinkTested = false;
  await resetTempRoot();
  await writeFile(path.join(tempRoot, "README.md"), "# Symlink\n", "utf8");
  try {
    await symlink(repoRoot, path.join(tempRoot, "outside-link"), "junction");
    symlinkTested = true;
  } catch {
    symlinkTested = false;
  }
  const symlinkReport = await inspectRepository(tempRoot);
  await assertValidReport(symlinkReport);
  if (symlinkTested) {
    assert.ok(symlinkReport.warnings.some((warning) => warning.code === "external_symlink_not_followed" || warning.code === "symlink_not_followed"));
  } else {
    assert.ok(true, "symlink creation was unavailable in this environment");
  }

  const invalidReport = {
    ...validReport,
    status: "executed"
  };
  await assertInvalidReport(invalidReport);

  console.log("PASSED repository intelligence tests");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
