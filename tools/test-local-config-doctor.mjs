import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  EnvironmentSecretProvider,
  LOCAL_CONFIG_CAPABILITIES,
  createLocalConfig,
  loadLocalConfig
} from "../src/config/local-config.mjs";

import {
  runEnvironmentDoctor
} from "../src/config/environment-doctor.mjs";

import {
  loadSchema,
  validateValue
} from "./validate-examples.mjs";

const root = await mkdtemp(
  path.join(os.tmpdir(), "kaveep-config-test-")
);

const repository = path.join(root, "repository");
const data = path.join(root, "data");
const configPath = path.join(root, "config.json");

const syntheticSecret =
  "TEST_ONLY_REDACTED_PROVIDER_VALUE";

const clock = () =>
  new Date("2026-07-11T00:00:00.000Z");

async function readConfig() {
  return JSON.parse(
    await readFile(configPath, "utf8")
  );
}

async function writeConfig(config) {
  await writeFile(
    configPath,
    `${JSON.stringify(config, null, 2)}\n`
  );
}

try {
  await mkdir(repository);

  const config = await createLocalConfig(
    {
      configPath,
      repositoryRoot: repository,
      dataRoot: data,
      model: "explicit-model",
      executionProfile: "node",
      image: "node:22-bookworm-slim"
    },
    {
      clock
    }
  );

  assert.equal(
    config.provider.id,
    "openai"
  );

  assert.equal(
    config.provider.secretReference,
    "OPENAI_API_KEY"
  );

  assert.equal(
    config.provider.model,
    "explicit-model"
  );

  assert.equal(
    JSON.stringify(config).includes(syntheticSecret),
    false
  );

  assert.deepEqual(
    LOCAL_CONFIG_CAPABILITIES.implementedProviders,
    ["openai", "local-openai-compatible"]
  );

  assert.equal(
    LOCAL_CONFIG_CAPABILITIES.offlineCapable,
    "provider-dependent"
  );

  assert.equal(
    LOCAL_CONFIG_CAPABILITIES.networkRequired,
    "provider-dependent"
  );

  assert.equal(
    LOCAL_CONFIG_CAPABILITIES.zeroBudgetCoreMode,
    "IMPLEMENTED_UNVERIFIED"
  );

  const loaded = await loadLocalConfig(configPath);

  const canonicalDataRoot =
    await import("node:fs/promises")
      .then(({ realpath }) => realpath(data));

  assert.equal(
    loaded.dataRoot,
    canonicalDataRoot
  );

  await assert.rejects(
    () =>
      createLocalConfig({
        configPath: path.join(root, "bad.json"),
        repositoryRoot: repository,
        dataRoot: path.join(repository, ".kaveep"),
        model: "model"
      }),
    /isolated/
  );

  const validConfig = await readConfig();

  await writeConfig({
    ...validConfig,
    provider: {
      ...validConfig.provider,
      id: "ollama"
    }
  });

  await assert.rejects(
    () => loadLocalConfig(configPath),
    /Unsupported provider id: ollama/
  );

  await writeConfig({
    ...validConfig,
    provider: {
      ...validConfig.provider,
      secretReference: "UNRELATED_KEY"
    }
  });

  await assert.rejects(
    () => loadLocalConfig(configPath),
    /must reference OPENAI_API_KEY/
  );

  await writeConfig({
    ...validConfig,
    defaults: {
      ...validConfig.defaults,
      maxAttempts: 0
    }
  });

  await assert.rejects(
    () => loadLocalConfig(configPath),
    /positive safe integer/
  );

  await writeConfig(validConfig);

  const provider =
    new EnvironmentSecretProvider({
      OPENAI_API_KEY: syntheticSecret
    });

  const value =
    provider.resolve("OPENAI_API_KEY");

  assert.equal(
    value.reveal(),
    syntheticSecret
  );

  assert.equal(
    String(value),
    "[REDACTED]"
  );

  assert.equal(
    JSON.stringify(value),
    '"[REDACTED]"'
  );

  assert.equal(
    JSON.stringify(provider)
      .includes(syntheticSecret),
    false
  );

  const successfulProcessAdapter = {
    async run(file) {
      return String(file)
        .toLowerCase()
        .includes("git")
        ? {
          code: 0,
          stdout: "git version test",
          stderr: ""
        }
        : {
          code: 0,
          stdout: "29.0.0",
          stderr: ""
        };
    }
  };

  const ready = await runEnvironmentDoctor(
    configPath,
    {
      processAdapter:
        successfulProcessAdapter,
      dockerExecutable:
        process.execPath,
      environment: {
        OPENAI_API_KEY: syntheticSecret
      }
    }
  );

  assert.equal(
    ready.status,
    "ready_with_warnings"
  );

  assert.equal(
    ready.readyForStandalone,
    true
  );

  assert.equal(
    ready.provider.providerId,
    "openai"
  );

  assert.equal(
    ready.provider.networkRequired,
    true
  );

  assert.equal(
    ready.provider.offlineCapable,
    false
  );

  assert.equal(
    ready.zeroBudget.status,
    "UNVERIFIED"
  );

  assert.equal(
    ready.checks
      .find((item) => item.id === "provider")
      .status,
    "passed"
  );

  assert.equal(
    ready.checks
      .find(
        (item) =>
          item.id === "provider_runtime_mode"
      )
      .status,
    "warning"
  );

  assert.equal(
    ready.checks
      .find(
        (item) =>
          item.id === "zero_budget_core_mode"
      )
      .status,
    "warning"
  );

  assert.equal(
    JSON.stringify(ready)
      .includes(syntheticSecret),
    false
  );

  assert(
    JSON.stringify(ready)
      .includes("[REDACTED]")
  );

  const missing = await runEnvironmentDoctor(
    configPath,
    {
      processAdapter: {
        run: async () => ({
          code: 1,
          stdout: "",
          stderr: "offline"
        })
      },
      dockerExecutable:
        process.execPath,
      environment: {}
    }
  );

  assert.equal(
    missing.status,
    "blocked"
  );

  assert.equal(
    missing.readyForStandalone,
    false
  );

  assert.equal(
    missing.checks
      .find((item) => item.id === "container")
      .status,
    "failed"
  );

  assert.equal(
    missing.checks
      .find(
        (item) =>
          item.id === "provider_secret"
      )
      .status,
    "failed"
  );

  const authority = {
    authoritySnapshotId:
      "authority_snapshot_config_001",
    schemaVersion: "1.0.0",
    repositoryRoot: config.repositoryRoot,
    authorityChain: [
      {
        precedence: 1,
        authorityType:
          "engineering_constitution",
        ownerRepository:
          "KAVEEP-DEV-AGENT",
        documentRef:
          "authority_document_config_001"
      }
    ],
    authorityDocuments: [
      {
        documentId:
          "authority_document_config_001",
        path:
          "ENGINEERING-CONSTITUTION.md",
        sha256: "a".repeat(64),
        bytes: 1,
        verificationStatus: "verified"
      }
    ],
    limitations: [
      "Test evidence."
    ],
    warnings: [],
    evidenceRefs: [
      "evidence_config_001"
    ],
    status: "verified",
    createdAt: clock().toISOString()
  };

  const mission = {
    missionLockId:
      "mission_lock_config_001",
    schemaVersion: "1.0.0",
    authoritySnapshotRef:
      authority.authoritySnapshotId,
    lockedPrinciples: [
      {
        principleId:
          "principle_config_001",
        name: "Human Authority",
        statement:
          "Human authority remains above AI autonomy.",
        sourceDocumentRef:
          "authority_document_config_001"
      }
    ],
    protectedArtifacts: [
      {
        path:
          "ENGINEERING-CONSTITUTION.md",
        protectionLevel:
          "governance_locked",
        reason:
          "Governance process required."
      }
    ],
    prohibitedAutonomousChanges: [
      "governance"
    ],
    kcpRequiredChanges: [
      "architecture"
    ],
    humanApprovalRequiredChanges: [
      "source_write_back"
    ],
    limitations: [
      "No authority granted."
    ],
    status: "active",
    createdAt: clock().toISOString()
  };

  const authorityFile =
    path.join(root, "authority.json");

  const missionFile =
    path.join(root, "mission.json");

  const requestFile =
    path.join(root, "request.json");

  await writeFile(
    authorityFile,
    JSON.stringify(authority)
  );

  await writeFile(
    missionFile,
    JSON.stringify(mission)
  );

  execFileSync(
    process.execPath,
    [
      path.resolve("tools/kaveep.mjs"),
      "request",
      configPath,
      authorityFile,
      missionFile,
      requestFile,
      "แก้ไข",
      "src/index.mjs"
    ],
    {
      cwd: path.resolve("."),
      windowsHide: true
    }
  );

  const generated = JSON.parse(
    await readFile(requestFile, "utf8")
  );

  const requestSchemaPath = path.resolve(
    "schemas/standalone-session-request.schema.json"
  );

  const requestSchema =
    await loadSchema(requestSchemaPath);

  const requestErrors = [];

  await validateValue(
    generated,
    requestSchema,
    {
      schemaPath: requestSchemaPath,
      rootSchema: requestSchema
    },
    "$",
    requestErrors
  );

  assert.deepEqual(
    requestErrors,
    []
  );

  assert.equal(
    generated.brain.providerId,
    "openai"
  );

  assert.equal(
    generated.container.executionProfile,
    "node"
  );

  assert.equal(
    generated.workspaceIndex.indexRoot,
    config.roots.workspaceIndex
  );

  assert.equal(
    (await readFile(configPath, "utf8"))
      .includes(syntheticSecret),
    false
  );

  console.log(
    [
      "PASSED local config/doctor:",
      "unsupported providers rejected;",
      "provider metadata correlated;",
      "zero-budget status UNVERIFIED;",
      "network/offline requirements explicit;",
      "invalid limits rejected;",
      "secrets redacted;",
      "Docker and credentials fail closed"
    ].join(" ")
  );
} finally {
  await rm(root, {
    recursive: true,
    force: true
  });
}
