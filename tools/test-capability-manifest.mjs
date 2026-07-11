import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCapabilityManifest } from "../src/capabilities/capability-manifest-validator.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const manifestPath = path.join(
  repoRoot,
  "capabilities",
  "repository-capability-manifest.json"
);

const canonicalManifest = JSON.parse(
  await readFile(manifestPath, "utf8")
);

function clone(value) {
  return structuredClone(value);
}

function hasError(result, code) {
  return result.errors.some((finding) => finding.code === code);
}

function hasDrift(result, code) {
  return result.drift.some((finding) => finding.code === code);
}

async function runTest(name, test) {
  try {
    await test();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

await runTest(
  "canonical manifest is honestly UNVERIFIED and non-blocking",
  async () => {
    const result = await validateCapabilityManifest({ repoRoot });

    assert.equal(result.status, "UNVERIFIED");
    assert.equal(result.blocking, false);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.drift, []);
    assert.equal(result.repository, "KAVEEP-DEV-AGENT");
    assert.equal(
      result.manifestPath,
      "capabilities/repository-capability-manifest.json"
    );
    assert.equal(result.capabilitiesInspected.length, 1);
    assert.equal(result.capabilitiesInspected[0].valid, true);
    assert.equal(result.evidenceInspected.length, 1);
    assert.equal(result.evidenceInspected[0].status, "PRESENT");
  }
);

await runTest("validation is deterministic", async () => {
  const first = await validateCapabilityManifest({
    repoRoot,
    manifest: clone(canonicalManifest)
  });
  const second = await validateCapabilityManifest({
    repoRoot,
    manifest: clone(canonicalManifest)
  });

  assert.deepEqual(second, first);
});

await runTest("duplicate capability IDs fail closed", async () => {
  const manifest = clone(canonicalManifest);
  manifest.capabilities.push(clone(manifest.capabilities[0]));

  const result = await validateCapabilityManifest({ repoRoot, manifest });

  assert.equal(result.status, "INVALID");
  assert.equal(result.blocking, true);
  assert.equal(hasError(result, "ERR_CAPABILITY_ID_DUPLICATE"), true);
});

await runTest("path traversal fails closed", async () => {
  const manifest = clone(canonicalManifest);
  manifest.capabilities[0].governingSpecification = "../SPEC-038.md";
  manifest.capabilities[0].evidence[0].path = "../SPEC-038.md";

  const result = await validateCapabilityManifest({ repoRoot, manifest });

  assert.equal(result.status, "INVALID");
  assert.equal(result.blocking, true);
  assert.equal(hasError(result, "ERR_SPECIFICATION_PATH"), true);
  assert.equal(hasError(result, "ERR_EVIDENCE_PATH"), true);
});

await runTest("unknown fields fail closed", async () => {
  const manifest = clone(canonicalManifest);
  manifest.unapprovedAuthority = true;
  manifest.capabilities[0].silentPromotion = "LIVE_CERTIFIED";

  const result = await validateCapabilityManifest({ repoRoot, manifest });

  assert.equal(result.status, "INVALID");
  assert.equal(result.blocking, true);
  assert.equal(hasError(result, "ERR_MANIFEST_UNKNOWN_FIELD"), true);
});

await runTest("package version mismatch is blocking drift", async () => {
  const manifest = clone(canonicalManifest);
  manifest.packageVersion = "9.9.9";

  const result = await validateCapabilityManifest({ repoRoot, manifest });

  assert.equal(result.status, "DRIFT_DETECTED");
  assert.equal(result.blocking, true);
  assert.equal(hasDrift(result, "DRIFT_PACKAGE_VERSION"), true);
});

await runTest("missing specification is blocking drift", async () => {
  const manifest = clone(canonicalManifest);
  const capability = manifest.capabilities[0];

  capability.governingSpecification = "specs/SPEC-999.md";
  capability.evidence[0].path = "specs/SPEC-999.md";
  manifest.highestSpecifiedMilestone = "SPEC-999";

  const result = await validateCapabilityManifest({ repoRoot, manifest });

  assert.equal(result.status, "DRIFT_DETECTED");
  assert.equal(result.blocking, true);
  assert.equal(
    result.drift.some(
      (finding) =>
        finding.code === "DRIFT_GOVERNINGSPECIFICATION_PATH" ||
        finding.code === "DRIFT_EVIDENCE_PATH" ||
        finding.code === "DRIFT_MILESTONE_SPECIFICATION"
    ),
    true
  );
});

await runTest(
  "quality-gate registration is not successful execution evidence",
  async () => {
    const manifest = clone(canonicalManifest);
    const capability = manifest.capabilities[0];

    capability.implementationPaths = [
      "src/capabilities/capability-manifest-validator.mjs"
    ];
    capability.testPaths = ["tools/test-capability-manifest.mjs"];
    capability.qualityGate = {
      name: "Capability Manifest",
      testPath: "tools/test-capability-manifest.mjs"
    };
    capability.capabilityStatus = "SELF_TESTED";
    capability.certificationStatus = "UNVERIFIED";
    capability.evidence = [
      {
        evidenceId: "evidence_spec_038_present",
        evidenceType: "SPECIFICATION",
        path: "specs/SPEC-038.md",
        claim: "SPECIFIED",
        status: "PRESENT",
        limitations: [],
        evidenceVersion: "0.1.0"
      },
      {
        evidenceId: "evidence_gate_registered",
        evidenceType: "QUALITY_GATE",
        path: "tools/run-quality-gates.mjs",
        claim: "SELF_TESTED",
        status: "PRESENT",
        limitations: [
          "Gate registration does not prove successful execution."
        ],
        evidenceVersion: "0.1.0"
      }
    ];
    capability.limitations = [
      "No successful self-test execution evidence is present."
    ];
    manifest.highestImplementedMilestone = "SPEC-038";
    manifest.highestSelfTestedMilestone = "UNVERIFIED";

    const result = await validateCapabilityManifest({ repoRoot, manifest });

    assert.equal(result.status, "INVALID");
    assert.equal(result.blocking, true);
    assert.equal(
      hasError(result, "ERR_CAPABILITY_EVIDENCE_MISSING"),
      true
    );
  }
);

await runTest(
  "live certification without matching evidence fails closed",
  async () => {
    const manifest = clone(canonicalManifest);
    const capability = manifest.capabilities[0];

    capability.certificationStatus = "LIVE_CERTIFIED";
    capability.limitations = [
      "No successful live-runtime certification evidence is present."
    ];

    const result = await validateCapabilityManifest({ repoRoot, manifest });

    assert.equal(result.status, "INVALID");
    assert.equal(result.blocking, true);
    assert.equal(
      hasError(result, "ERR_CERTIFICATION_EVIDENCE_MISSING"),
      true
    );
  }
);

await runTest(
  "UNVERIFIED is not converted to FAILED or LIVE_CERTIFIED",
  async () => {
    const manifest = clone(canonicalManifest);
    const result = await validateCapabilityManifest({ repoRoot, manifest });

    assert.equal(result.status, "UNVERIFIED");
    assert.equal(
      result.capabilitiesInspected[0].certificationStatus,
      "NOT_REQUIRED"
    );
    assert.notEqual(result.status, "INVALID");
    assert.equal(
      result.capabilitiesInspected.some(
        (entry) => entry.certificationStatus === "LIVE_CERTIFIED"
      ),
      false
    );
  }
);

console.log("PASSED capability manifest regression tests");
