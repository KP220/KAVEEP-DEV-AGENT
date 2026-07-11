import assert from "node:assert/strict";

import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";

import {
  LlmAdapterRegistry
} from "../src/brain/engineering-brain.mjs";

import {
  cancelConfiguredSession,
  createProviderRegistry,
  recoverConfiguredSession,
  runConfiguredSession,
  statusConfiguredSession
} from "../src/app/standalone-app.mjs";

import {
  createLocalConfig
} from "../src/config/local-config.mjs";

import {
  createAuthoritySnapshot
} from "../src/governance/authority-governance.mjs";

const root = await mkdtemp(
  path.join(
    os.tmpdir(),
    "kaveep-app-test-"
  )
);

const repo = path.join(root, "repo");
const data = path.join(root, "data");
const configPath = path.join(root, "config.json");

const clock = () =>
  new Date("2026-07-11T00:00:00.000Z");

function createMockAdapter() {
  let brainCall = 0;

  return {
    async generateStructured({ input }) {
      const parsed = JSON.parse(input);
      const phase = brainCall++ % 3;

      if (phase === 0) {
        return {
          value: {
            kind: "tool_call",
            actionId: `read_${brainCall}`,
            tool: "read_file",
            arguments: {
              path: "src/index.mjs"
            }
          }
        };
      }

      if (phase === 1) {
        return {
          value: {
            kind: "tool_call",
            actionId: `edit_${brainCall}`,
            tool: "edit_sandbox",
            arguments: {
              edits: [
                {
                  operation: "overwrite",
                  path: "src/index.mjs",
                  reason: "Requested change.",
                  text:
                    "export const value = 2;\n"
                }
              ]
            }
          }
        };
      }

      return {
        value: {
          kind: "finish",
          proposal: {
            proposalId:
              `engineering_proposal_app_${brainCall}`,
            schemaVersion: "1.0.0",
            ...parsed.refs,
            objective: parsed.objective,
            analysis:
              "Dynamic read and edit completed.",
            assumptions: [],
            proposedEdits: [
              {
                operation: "overwrite",
                path: "src/index.mjs",
                reason: "Requested change.",
                text:
                  "export const value = 2;\n"
              }
            ],
            validationFiles: [
              "src/index.mjs"
            ],
            risks: [
              {
                level: "low",
                description: "Value changes.",
                mitigation: "Review."
              }
            ],
            requiresPolicyEvaluation: false,
            requiresKcp: false,
            requiresHumanApproval: true,
            proposalAuthorizesExecution: false,
            status: "proposed",
            recommendedNextAction:
              "review_proposal"
          }
        }
      };
    }
  };
}

try {
  await mkdir(
    path.join(repo, "src"),
    {
      recursive: true
    }
  );

  await writeFile(
    path.join(
      repo,
      "ENGINEERING-CONSTITUTION.md"
    ),
    [
      "# Constitution",
      "Human authority.",
      ""
    ].join("\n")
  );

  await writeFile(
    path.join(
      repo,
      "ENGINEERING-CHARTER.md"
    ),
    [
      "# Charter",
      "Validation before trust.",
      ""
    ].join("\n")
  );

  await writeFile(
    path.join(repo, "README.md"),
    "# Fixture\n"
  );

  await writeFile(
    path.join(repo, "package.json"),
    JSON.stringify({
      name: "fixture",
      scripts: {
        lint:
          "node --check src/index.mjs",
        test: "node --test"
      }
    })
  );

  await writeFile(
    path.join(repo, "src/index.mjs"),
    "export const value = 1;\n"
  );

  const original = await readFile(
    path.join(repo, "src/index.mjs"),
    "utf8"
  );

  const config = await createLocalConfig(
    {
      configPath,
      repositoryRoot: repo,
      dataRoot: data,
      model: "mock-model",
      executionProfile: "node",
      image: "node:test"
    },
    {
      clock
    }
  );

  const snapshot =
    await createAuthoritySnapshot(
      repo,
      [
        {
          documentId: "constitution",
          path:
            "ENGINEERING-CONSTITUTION.md",
          precedence: 1,
          authorityType:
            "engineering_constitution",
          ownerRepository:
            "KAVEEP-DEV-AGENT"
        },
        {
          documentId: "charter",
          path:
            "ENGINEERING-CHARTER.md",
          precedence: 2,
          authorityType: "charter",
          ownerRepository:
            "KAVEEP-DEV-AGENT"
        }
      ],
      {
        snapshotId: "app_001",
        clock
      }
    );

  const lock = {
    missionLockId:
      "mission_lock_app_001",
    schemaVersion: "1.0.0",
    authoritySnapshotRef:
      snapshot.authoritySnapshotId,
    lockedPrinciples: [
      {
        principleId:
          "principle_app_001",
        name: "Human Authority",
        statement:
          "Human authority remains above AI autonomy.",
        sourceDocumentRef:
          snapshot.authorityDocuments[0]
            .documentId
      }
    ],
    protectedArtifacts:
      snapshot.authorityDocuments.map(
        (item) => ({
          path: item.path,
          protectionLevel:
            "governance_locked",
          reason:
            "Governance required."
        })
      ),
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

  await writeFile(
    authorityFile,
    JSON.stringify(snapshot)
  );

  await writeFile(
    missionFile,
    JSON.stringify(lock)
  );

  const registry =
    new LlmAdapterRegistry()
      .register(
        "openai",
        createMockAdapter()
      );

  const mismatchedRegistry =
    new LlmAdapterRegistry()
      .register(
        "anthropic",
        createMockAdapter()
      );

  await assert.rejects(
    () =>
      createProviderRegistry(
        config,
        {
          registry:
            mismatchedRegistry
        }
      ),
    /does not contain an adapter for configured provider: openai/
  );

  const doctorAdapter = {
    async run(file) {
      return String(file)
        .toLowerCase()
        .includes("git")
        ? {
          code: 0,
          stdout:
            "git version test",
          stderr: ""
        }
        : {
          code: 0,
          stdout: "29",
          stderr: ""
        };
    }
  };

  const containerAdapter = {
    async run(_file, args) {
      return args[0] === "info"
        ? {
          exitCode: 0,
          stdout: "29",
          stderr: "",
          timedOut: false,
          overflow: false,
          durationMs: 1
        }
        : {
          exitCode: 0,
          stdout: "ok",
          stderr: "",
          timedOut: false,
          overflow: false,
          durationMs: 1
        };
    }
  };

  const options = {
    clock,
    registry,
    environment: {
      OPENAI_API_KEY:
        "TEST_ONLY_PROVIDER_SECRET"
    },
    doctorOptions: {
      clock,
      environment: {
        OPENAI_API_KEY:
          "TEST_ONLY_PROVIDER_SECRET"
      },
      processAdapter:
        doctorAdapter,
      dockerExecutable:
        process.execPath
    },
    containerProcessAdapter:
      containerAdapter,
    dockerExecutable:
      "docker-mock"
  };

  const blocked =
    await runConfiguredSession(
      {
        configPath,
        authorityFile,
        missionFile,
        command:
          "modify code in src/index.mjs"
      },
      {
        ...options,
        registry:
          mismatchedRegistry,
        id:
          "app_provider_mismatch_001"
      }
    );

  assert.equal(
    blocked.status,
    "blocked"
  );

  assert.equal(
    blocked.durable,
    null
  );

  assert.equal(
    blocked.error.code,
    "PROVIDER_RUNTIME_MISMATCH"
  );

  assert.match(
    blocked.error.message,
    /configured provider: openai/
  );

  assert.equal(
    await readFile(
      path.join(
        repo,
        "src/index.mjs"
      ),
      "utf8"
    ),
    original
  );

  const run =
    await runConfiguredSession(
      {
        configPath,
        authorityFile,
        missionFile,
        command:
          "modify code in src/index.mjs"
      },
      {
        ...options,
        id: "app_run_001"
      }
    );

  assert.equal(
    run.status,
    "awaiting_approval",
    JSON.stringify(run)
  );

  assert.equal(
    run.providerRuntime
      .configuredProviderId,
    "openai"
  );

  assert.equal(
    run.providerRuntime
      .registeredProviderId,
    "openai"
  );

  assert.equal(
    run.providerRuntime.correlated,
    true
  );

  assert.equal(
    run.request.brain.providerId,
    config.provider.id
  );

  const id =
    run.durable.record
      .durableSessionId;

  assert.equal(
    await readFile(
      path.join(
        repo,
        "src/index.mjs"
      ),
      "utf8"
    ),
    original
  );

  const status =
    await statusConfiguredSession(
      configPath,
      id
    );

  assert.equal(
    status.status,
    "verified"
  );

  const recovery =
    await recoverConfiguredSession(
      configPath,
      id,
      options
    );

  assert.equal(
    recovery.status,
    "restarted_from_received"
  );

  assert.equal(
    recovery.recovered
      .result.events[0].state,
    "analyzing"
  );

  const blockedRecovery =
    await recoverConfiguredSession(
      configPath,
      id,
      {
        ...options,
        registry:
          mismatchedRegistry
      }
    );

  assert.equal(
    blockedRecovery.status,
    "blocked"
  );

  assert.equal(
    blockedRecovery.error.code,
    "PROVIDER_RUNTIME_MISMATCH"
  );

  assert.equal(
    (
      await cancelConfiguredSession(
        configPath,
        recovery.recoveredSessionRef,
        {
          clock
        }
      )
    ).status,
    "cancelled"
  );

  assert.equal(
    (
      await cancelConfiguredSession(
        configPath,
        id,
        {
          clock
        }
      )
    ).status,
    "cancelled"
  );

  console.log(
    [
      "PASSED standalone app:",
      "provider registry correlated;",
      "mismatched injected registry blocked;",
      "recovery mismatch blocked;",
      "provider evidence emitted;",
      "source unchanged without approval"
    ].join(" ")
  );
} finally {
  await rm(
    root,
    {
      recursive: true,
      force: true
    }
  );
}
