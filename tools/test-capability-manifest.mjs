import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
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

async function createMinimalRepositoryFixture(root) {
  const authorityPaths = [
    "ENGINEERING-CONSTITUTION.md",
    "ENGINEERING-CHARTER.md",
    "ENGINEERING-PHILOSOPHY.md",
    "ARCHITECTURE.md",
    "ENGINEERING-LIFECYCLE.md",
    "ENGINEERING-WORKFLOW.md",
    "REPOSITORY-STANDARD.md"
  ];

  await mkdir(path.join(root, "specs"), {
    recursive: true
  });

  await mkdir(path.join(root, "tools"), {
    recursive: true
  });

  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "@kaveep/dev-agent-test-fixture",
        version: canonicalManifest.packageVersion,
        private: true,
        type: "module"
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  for (const authorityPath of authorityPaths) {
    const content =
      authorityPath === "ARCHITECTURE.md"
        ? `# Test Architecture\n\nVersion\n\n${canonicalManifest.architectureVersion}\n`
        : `# ${authorityPath}\n`;

    await writeFile(
      path.join(root, authorityPath),
      content,
      "utf8"
    );
  }

  await writeFile(
    path.join(root, "specs", "SPEC-038.md"),
    "# SPEC-038 test fixture\n",
    "utf8"
  );

  await writeFile(
    path.join(root, "tools", "run-quality-gates.mjs"),
    "export {};\n",
    "utf8"
  );
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
    assert.equal(result.capabilitiesInspected.length, 2);
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

await runTest(
  "parent-directory symlink escape is rejected",
  async () => {
    const fixtureRoot = await mkdtemp(
      path.join(os.tmpdir(), "kaveep-capability-root-")
    );

    const outsideRoot = await mkdtemp(
      path.join(os.tmpdir(), "kaveep-capability-outside-")
    );

    try {
      await createMinimalRepositoryFixture(fixtureRoot);

      await writeFile(
        path.join(outsideRoot, "evidence.json"),
        "{}\n",
        "utf8"
      );

      const linkedDirectory = path.join(
        fixtureRoot,
        "linked-evidence"
      );

      await symlink(
        outsideRoot,
        linkedDirectory,
        process.platform === "win32" ? "junction" : "dir"
      );

      const manifest = clone(canonicalManifest);
      const capability = manifest.capabilities[0];

      capability.evidence[0].path =
        "linked-evidence/evidence.json";

      const result = await validateCapabilityManifest({
        repoRoot: fixtureRoot,
        manifest
      });

      assert.equal(result.status, "DRIFT_DETECTED");
      assert.equal(result.blocking, true);

      assert.equal(
        result.drift.some(
          (finding) =>
            finding.code === "DRIFT_EVIDENCE_PATH" &&
            finding.observed === "resolved_path_escape"
        ),
        true
      );

      assert.equal(
        result.evidenceInspected.some(
          (entry) =>
            entry.evidenceId ===
              capability.evidence[0].evidenceId &&
            entry.path ===
              "linked-evidence/evidence.json" &&
            entry.status === "MISMATCHED"
        ),
        true
      );
    } finally {
      await rm(fixtureRoot, {
        recursive: true,
        force: true
      });

      await rm(outsideRoot, {
        recursive: true,
        force: true
      });
    }
  }
);

console.log("PASSED capability manifest regression tests");
