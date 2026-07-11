import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  realpath,
  rename
} from "node:fs/promises";
import path from "node:path";
import { isInsideRoot } from "../repository/repository-intelligence.mjs";

const CURRENT_CONFIG_VERSION = "1.0.0";
const SUPPORTED_PROVIDER_IDS = new Set(["openai"]);
const SUPPORTED_SECRET_PROVIDERS = new Set([
  "environment",
  "windows-dpapi"
]);
const SUPPORTED_EXECUTION_PROFILES = new Set([
  "node",
  "python",
  "go",
  "rust"
]);

const forbidden =
  /(secret|token|password|credential|authorization|api.?key)/i;

const permittedReferenceKeys = new Set([
  "secretProvider",
  "secretReference",
  "maxOutputTokens"
]);

function rejectSecrets(value, location = "$") {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      rejectSecrets(item, `${location}[${index}]`);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (forbidden.test(key) && !permittedReferenceKeys.has(key)) {
      throw new Error(
        `Config contains forbidden secret-like key: ${location}.${key}`
      );
    }

    rejectSecrets(child, `${location}.${key}`);
  }
}

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value.trim();
}

function requirePositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }

  return value;
}

function validateProvider(provider) {
  if (!provider || typeof provider !== "object") {
    throw new Error("Provider configuration is required.");
  }

  const providerId = requireNonEmptyString(
    provider.id,
    "Provider id"
  );

  if (!SUPPORTED_PROVIDER_IDS.has(providerId)) {
    throw new Error(
      `Unsupported provider id: ${providerId}. ` +
      `Currently implemented providers: ${[
        ...SUPPORTED_PROVIDER_IDS
      ].join(", ")}.`
    );
  }

  const model = requireNonEmptyString(
    provider.model,
    "Provider model"
  );

  const secretProvider = requireNonEmptyString(
    provider.secretProvider,
    "Secret provider"
  );

  if (!SUPPORTED_SECRET_PROVIDERS.has(secretProvider)) {
    throw new Error(
      `Unsupported secret provider: ${secretProvider}.`
    );
  }

  const secretReference = requireNonEmptyString(
    provider.secretReference,
    "Secret reference"
  );

  if (
    providerId === "openai" &&
    secretProvider === "environment" &&
    secretReference !== "OPENAI_API_KEY"
  ) {
    throw new Error(
      "The OpenAI environment provider must reference OPENAI_API_KEY."
    );
  }

  return {
    id: providerId,
    model,
    secretProvider,
    secretReference
  };
}

function validateExecution(execution) {
  if (!execution || typeof execution !== "object") {
    throw new Error("Execution configuration is required.");
  }

  const profile = requireNonEmptyString(
    execution.profile,
    "Execution profile"
  );

  if (!SUPPORTED_EXECUTION_PROFILES.has(profile)) {
    throw new Error(
      `Unsupported execution profile: ${profile}.`
    );
  }

  const image = requireNonEmptyString(
    execution.image,
    "Container image"
  );

  if (
    !Array.isArray(execution.allowedImages) ||
    execution.allowedImages.length === 0
  ) {
    throw new Error(
      "Execution allowedImages must contain at least one image."
    );
  }

  const allowedImages = execution.allowedImages.map(
    (allowedImage, index) =>
      requireNonEmptyString(
        allowedImage,
        `Execution allowedImages[${index}]`
      )
  );

  if (!allowedImages.includes(image)) {
    throw new Error(
      "Configured container image must be present in allowedImages."
    );
  }

  if (typeof execution.requireContainer !== "boolean") {
    throw new Error(
      "Execution requireContainer must be a boolean."
    );
  }

  return {
    profile,
    image,
    allowedImages,
    requireContainer: execution.requireContainer
  };
}

function validateDefaults(defaults) {
  if (!defaults || typeof defaults !== "object") {
    throw new Error("Application defaults are required.");
  }

  return {
    maxContextCharacters: requirePositiveInteger(
      defaults.maxContextCharacters,
      "defaults.maxContextCharacters"
    ),
    maxOutputTokens: requirePositiveInteger(
      defaults.maxOutputTokens,
      "defaults.maxOutputTokens"
    ),
    maxEdits: requirePositiveInteger(
      defaults.maxEdits,
      "defaults.maxEdits"
    ),
    maxAttempts: requirePositiveInteger(
      defaults.maxAttempts,
      "defaults.maxAttempts"
    ),
    semanticMaxAttempts: requirePositiveInteger(
      defaults.semanticMaxAttempts,
      "defaults.semanticMaxAttempts"
    )
  };
}

async function atomic(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;

  await mkdir(path.dirname(file), { recursive: true });

  const handle = await open(temporary, "wx", 0o600);

  try {
    await handle.writeFile(
      `${JSON.stringify(value, null, 2)}\n`
    );
    await handle.sync();
  } finally {
    await handle.close();
  }

  await rename(temporary, file);
}

function createRoots(dataRoot) {
  return {
    sessions: path.join(dataRoot, "sessions"),
    workspaceIndex: path.join(dataRoot, "workspace-index"),
    approvals: path.join(dataRoot, "approval-ledger"),
    transactions: path.join(dataRoot, "transactions"),
    writes: path.join(dataRoot, "write-ledger"),
    gitApprovals: path.join(
      dataRoot,
      "git-approval-ledger"
    )
  };
}

async function validateRootIsolation(repositoryRoot, dataRoot) {
  const repository = await realpath(
    path.resolve(repositoryRoot)
  );
  const data = await realpath(path.resolve(dataRoot));

  if (
    isInsideRoot(repository, data) ||
    isInsideRoot(data, repository)
  ) {
    throw new Error(
      "Data root and repository must be isolated from each other."
    );
  }

  return {
    repository,
    data
  };
}

export async function createLocalConfig(
  {
    configPath,
    repositoryRoot,
    dataRoot,
    model,
    executionProfile = "node",
    image = "node:22-bookworm-slim"
  },
  options = {}
) {
  const explicitModel = requireNonEmptyString(
    model,
    "Provider model"
  );

  if (!SUPPORTED_EXECUTION_PROFILES.has(executionProfile)) {
    throw new Error(
      `Unsupported execution profile: ${executionProfile}.`
    );
  }

  requireNonEmptyString(image, "Container image");

  await mkdir(path.resolve(dataRoot), {
    recursive: true
  });

  const { repository, data } =
    await validateRootIsolation(repositoryRoot, dataRoot);

  const roots = createRoots(data);

  for (const directory of Object.values(roots)) {
    await mkdir(directory, {
      recursive: true
    });
  }

  const config = {
    configVersion: CURRENT_CONFIG_VERSION,
    repositoryRoot: repository,
    dataRoot: data,
    roots,
    provider: {
      id: "openai",
      model: explicitModel,
      secretProvider: "environment",
      secretReference: "OPENAI_API_KEY"
    },
    execution: {
      profile: executionProfile,
      image,
      allowedImages: [image],
      requireContainer: true
    },
    defaults: {
      maxContextCharacters: 100000,
      maxOutputTokens: 8000,
      maxEdits: 20,
      maxAttempts: 3,
      semanticMaxAttempts: 2
    },
    createdAt: (
      options.clock?.() ?? new Date()
    ).toISOString()
  };

  rejectSecrets(config);

  await atomic(path.resolve(configPath), config);

  return config;
}

export async function loadLocalConfig(configPath) {
  const config = JSON.parse(
    await readFile(path.resolve(configPath), "utf8")
  );

  rejectSecrets(config);

  if (config.configVersion !== CURRENT_CONFIG_VERSION) {
    throw new Error(
      `Unsupported local config version: ${config.configVersion}.`
    );
  }

  const { repository, data } =
    await validateRootIsolation(
      config.repositoryRoot,
      config.dataRoot
    );

  const provider = validateProvider(config.provider);
  const execution = validateExecution(config.execution);
  const defaults = validateDefaults(config.defaults);
  const expectedRoots = createRoots(data);

  if (!config.roots || typeof config.roots !== "object") {
    throw new Error("Configured data roots are required.");
  }

  for (const [name, expectedPath] of Object.entries(
    expectedRoots
  )) {
    if (
      path.resolve(config.roots[name] ?? "") !==
