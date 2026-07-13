import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  LlmAdapterRegistry,
  OpenAICompatibleChatAdapter,
  OpenAIResponsesAdapter
} from "../brain/engineering-brain.mjs";

import {
  EnvironmentSecretProvider,
  LOCAL_CONFIG_CAPABILITIES,
  loadLocalConfig
} from "../config/local-config.mjs";

import {
  WindowsDpapiSecretProvider
} from "../config/windows-dpapi-secret-provider.mjs";

import {
  runEnvironmentDoctor
} from "../config/environment-doctor.mjs";

import {
  cancelDurableSession,
  createDurableSessionStore,
  persistStandaloneSession,
  recoverDurableSession,
  replayDurableSession
} from "../persistence/durable-session-store.mjs";

const IMPLEMENTED_PROVIDER_FACTORIES = Object.freeze({
  openai: createOpenAIAdapter,
  "local-openai-compatible": createLocalOpenAiCompatibleAdapter
});
const LOCAL_RUNTIME_BUDGET = Object.freeze({ maxContextCharacters: 12000, maxOutputTokens: 1024 });

function runtimeBudget(config) {
  if (config.provider.id !== "local-openai-compatible") return config.defaults;
  return { ...config.defaults, maxContextCharacters: Math.min(config.defaults.maxContextCharacters, LOCAL_RUNTIME_BUDGET.maxContextCharacters), maxOutputTokens: Math.min(config.defaults.maxOutputTokens, LOCAL_RUNTIME_BUDGET.maxOutputTokens) };
}

export function resolveDefaultProfile(options = {}) {
  const configPath = path.resolve(options.configPath ?? process.env.KAVEEP_CONFIG ?? (process.platform === "win32" ? "C:\\KAVEEP\\data\\config.json" : path.join(process.env.HOME ?? ".", ".kaveep", "config.json")));
  const root = path.dirname(configPath);
  return { configPath, authorityFile: path.resolve(options.authorityFile ?? process.env.KAVEEP_AUTHORITY ?? path.join(root, "authority.json")), missionFile: path.resolve(options.missionFile ?? process.env.KAVEEP_MISSION ?? path.join(root, "mission.json")) };
}

function requireConfiguredProvider(config) {
  const providerId = config?.provider?.id;

  if (
    typeof providerId !== "string" ||
    providerId.length === 0
  ) {
    throw new Error(
      "Configured provider id is required at runtime."
    );
  }

  if (
    !LOCAL_CONFIG_CAPABILITIES
      .implementedProviders
      .includes(providerId)
  ) {
    throw new Error(
      `Configured provider is not implemented at runtime: ${providerId}.`
    );
  }

  if (
    typeof IMPLEMENTED_PROVIDER_FACTORIES[providerId] !==
    "function"
  ) {
    throw new Error(
      `Provider capability declaration and runtime factory do not correlate: ${providerId}.`
    );
  }

  return providerId;
}

function createSecretProvider(config, options = {}) {
  switch (config.provider.secretProvider) {
    case "environment":
      return new EnvironmentSecretProvider(
        options.environment ?? process.env
      );

    case "windows-dpapi":
      return new WindowsDpapiSecretProvider(
        options.dpapiOptions
      );

    default:
      throw new Error(
        `Unsupported runtime secret provider: ${config.provider.secretProvider}.`
      );
  }
}

async function createOpenAIAdapter(config, options = {}) {
  if (config.provider.id !== "openai") {
    throw new Error(
      `OpenAI adapter cannot serve configured provider: ${config.provider.id}.`
    );
  }

  const secretProvider =
    createSecretProvider(config, options);

  const secretValue =
    await secretProvider.resolve(
      config.provider.secretReference
    );

  const apiKey = secretValue.reveal();

  return new OpenAIResponsesAdapter({
    apiKey,
    fetchImpl: options.fetchImpl
  });
}

async function createLocalOpenAiCompatibleAdapter(config, options = {}) {
  if (config.provider.id !== "local-openai-compatible") {
    throw new Error("Local adapter provider mismatch.");
  }
  return new OpenAICompatibleChatAdapter({
    baseUrl: config.provider.baseUrl,
    fetchImpl: options.fetchImpl
  });
}

function verifyRegistryCorrelation(
  registry,
  providerId,
  source
) {
  if (
    !registry ||
    typeof registry.resolve !== "function"
  ) {
    throw new Error(
      `${source} must provide an LLM adapter registry.`
    );
  }

  try {
    registry.resolve(providerId);
  } catch {
    throw new Error(
      `${source} does not contain an adapter for configured provider: ${providerId}.`
    );
  }

  return registry;
}

export async function createProviderRegistry(
  config,
  options = {}
) {
  const providerId =
    requireConfiguredProvider(config);

  if (options.registry) {
    return verifyRegistryCorrelation(
      options.registry,
      providerId,
      "Injected registry"
    );
  }

  const factory =
    IMPLEMENTED_PROVIDER_FACTORIES[providerId];

  const adapter =
    await factory(config, options);

  const registry =
    new LlmAdapterRegistry()
      .register(providerId, adapter);

  return verifyRegistryCorrelation(
    registry,
    providerId,
    "Runtime registry"
  );
}

export function createSessionRequest(
  config,
  authoritySnapshot,
  missionLock,
  command,
  options = {}
) {
  const explicitCommand =
    String(command ?? "").trim();

  if (!explicitCommand) {
    throw new Error(
      "Engineering command is required."
    );
  }

  const providerId =
    requireConfiguredProvider(config);
  const budget = runtimeBudget(config);

  if (
    authoritySnapshot.repositoryRoot !==
      config.repositoryRoot ||
    missionLock.authoritySnapshotRef !==
      authoritySnapshot.authoritySnapshotId ||
    authoritySnapshot.status !== "verified" ||
    missionLock.status !== "active"
  ) {
    throw new Error(
      "Authority Snapshot, Mission Lock, and configured repository do not correlate."
    );
  }

  return {
    sessionRequestId:
      `standalone_session_request_${
        options.id ??
        randomBytes(10).toString("hex")
      }`,
    schemaVersion: "1.0.0",
    command: explicitCommand,
    repositoryRoot: config.repositoryRoot,
    authoritySnapshot,
    missionLock,
    brain: {
      providerId,
      model: config.provider.model,
      budget: {
        maxContextCharacters:
          budget.maxContextCharacters,
        maxOutputTokens:
          budget.maxOutputTokens,
        maxEdits:
          config.defaults.maxEdits,
        timeoutMs: 120000
      },
      maxContextFiles: 50
    },
    sandboxLimits: {
      maxFiles: 10000,
      maxDirectories: 2000,
      maxTotalBytes: 268435456,
      maxSingleFileBytes: 2097152,
      maxDepth: 30,
      maxPathLength: 512,
      maxLifetimeSeconds: 7200
    },
    workspaceIndex: {
      enabled: true,
      indexRoot:
        config.roots.workspaceIndex,
      limits: {
        maxFiles: 20000,
        maxDirectories: 5000,
        maxDepth: 30,
        maxFileBytes: 1048576
      },
      retrieval: {
        maxResults: 30,
        maxSnippetCharacters: 1000,
        maxContextCharacters: 30000
      }
    },
    loop: {
      maxAttempts:
        config.defaults.maxAttempts,
      semanticMaxAttempts:
        config.defaults.semanticMaxAttempts,
      maxSemanticFeedbackCharacters: 20000
    },
    container: {
      enabled: true,
      required:
        config.execution.requireContainer,
      executionProfile:
        config.execution.profile,
      image:
        config.execution.image,
      allowedImages:
        config.execution.allowedImages,
      operations: [
        "lint",
        "typecheck",
        "test",
        "build"
      ],
      limits: {
        timeoutMsPerOperation: 300000,
        maxOutputBytes: 1048576,
        memoryMb: 2048,
        cpus: 2,
        pids: 256
      }
    },
    status: "proposed",
    createdAt:
      (
        options.clock?.() ??
        new Date()
      ).toISOString()
  };
}

async function readGovernanceFiles(
  authorityFile,
  missionFile
) {
  const [
    authoritySnapshotRaw,
    missionLockRaw
  ] = await Promise.all([
    readFile(
      path.resolve(authorityFile),
      "utf8"
    ),
    readFile(
      path.resolve(missionFile),
      "utf8"
    )
  ]);

  return {
    authoritySnapshot:
      JSON.parse(authoritySnapshotRaw),
    missionLock:
      JSON.parse(missionLockRaw)
  };
}

function addDynamicBrainSettings(
  request,
  options
) {
  Object.assign(request.brain, {
    mode: options.engineeringMode ?? (request.brain.providerId === "local-openai-compatible" ? "iterative_proposal_loop" : "dynamic_tool_loop"),
    maxDynamicTurns: 15,
    maxDynamicToolCalls: 30,
    maxToolResultCharacters: 20000,
    maxTranscriptCharacters: 200000
  });

  return request;
}

function blockedProviderResult(error, doctor = null) {
  return {
    status: "blocked",
    doctor,
    durable: null,
    error: {
      code: "PROVIDER_RUNTIME_MISMATCH",
      message: String(error.message)
    }
  };
}

export async function runConfiguredSession(
  {
    configPath,
    authorityFile,
    missionFile,
    command
  },
  options = {}
) {
  const config =
    await loadLocalConfig(configPath);

  const doctor =
    await runEnvironmentDoctor(
      configPath,
      options.doctorOptions ?? options
    );

  if (
    !doctor.readyForStandalone &&
    !options.allowMockReadiness
  ) {
    return {
      status: "blocked",
      doctor,
      durable: null
    };
  }

  let registry;

  try {
    registry =
      await createProviderRegistry(
        config,
        options
      );
  } catch (error) {
    return blockedProviderResult(
      error,
      doctor
    );
  }

  const {
    authoritySnapshot,
    missionLock
  } = await readGovernanceFiles(
    authorityFile,
    missionFile
  );

  const request =
    addDynamicBrainSettings(
      createSessionRequest(
        config,
        authoritySnapshot,
        missionLock,
        command,
        options
      ),
      options
    );

  await createDurableSessionStore(
    config.roots.sessions,
    {},
    options
  );

  const durable =
    await persistStandaloneSession(
      config.roots.sessions,
      request,
      registry,
      {
        ...options,
        sessionId:
          request.sessionRequestId.replace(
            /^standalone_session_request_/,
            ""
          )
      }
    );

  return {
    status: durable.result.status,
    doctor,
    request,
    providerRuntime: {
      configuredProviderId:
        config.provider.id,
      registeredProviderId:
        request.brain.providerId,
      correlated: true
    },
    durable
  };
}

export async function askConfiguredSession(command, options = {}) {
  return runConfiguredSession({ ...resolveDefaultProfile(options), command }, options);
}

export async function statusConfiguredSession(
  configPath,
  sessionId
) {
  const config =
    await loadLocalConfig(configPath);

  requireConfiguredProvider(config);

  return replayDurableSession(
    config.roots.sessions,
    sessionId
  );
}

export async function recoverConfiguredSession(
  configPath,
  sessionId,
  options = {}
) {
  const config =
    await loadLocalConfig(configPath);

  const doctor =
    await runEnvironmentDoctor(
      configPath,
      options.doctorOptions ?? options
    );

  if (
    !doctor.readyForStandalone &&
    !options.allowMockReadiness
  ) {
    return {
      status: "blocked",
      doctor
    };
  }

  let registry;

  try {
    registry =
      await createProviderRegistry(
        config,
        options
      );
  } catch (error) {
    return blockedProviderResult(
      error,
      doctor
    );
  }

  return recoverDurableSession(
    config.roots.sessions,
    sessionId,
    registry,
    options
  );
}

export async function cancelConfiguredSession(
  configPath,
  sessionId,
  options = {}
) {
  const config =
    await loadLocalConfig(configPath);

  requireConfiguredProvider(config);

  return cancelDurableSession(
    config.roots.sessions,
    sessionId,
    options
  );
}
