import { spawn } from "node:child_process";
import {
  access,
  open,
  realpath,
  rm
} from "node:fs/promises";
import path from "node:path";

import {
  EnvironmentSecretProvider,
  LOCAL_CONFIG_CAPABILITIES,
  loadLocalConfig
} from "./local-config.mjs";

import {
  WindowsDpapiSecretProvider
} from "./windows-dpapi-secret-provider.mjs";

function run(file, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      child.kill();

      finish({
        code: null,
        stdout,
        stderr: "Process timed out."
      });
    }, options.timeoutMs ?? 10000);

    child.once("error", (error) => {
      finish({
        code: null,
        stdout,
        stderr: error.message
      });
    });

    child.once("exit", (code) => {
      finish({
        code,
        stdout,
        stderr
      });
    });
  });
}

async function writable(directory) {
  const file = path.join(
    directory,
    `.doctor-${process.pid}-${Date.now()}`
  );

  try {
    const handle = await open(file, "wx", 0o600);
    await handle.close();
    await rm(file);

    return true;
  } catch {
    return false;
  }
}

function createCheck(id, status, detail, metadata = {}) {
  return {
    id,
    status,
    detail,
    ...metadata
  };
}

function createProviderMetadata(config) {
  const local = config.provider.id === "local-openai-compatible";
  return {
    providerId: config.provider.id,
    model: config.provider.model,
    implementationStatus: "implemented",
    secretProvider: config.provider.secretProvider,
    secretReference: config.provider.secretReference,
    networkRequired: local ? false : true,
    offlineCapable: local,
    zeroBudgetCoreMode:
      LOCAL_CONFIG_CAPABILITIES.zeroBudgetCoreMode
  };
}

function createSecretProvider(config, options) {
  if (config.provider.secretProvider === "windows-dpapi") {
    return new WindowsDpapiSecretProvider(
      options.dpapiOptions
    );
  }

  return new EnvironmentSecretProvider(
    options.environment ?? process.env
  );
}

export async function runEnvironmentDoctor(
  configPath,
  options = {}
) {
  const checks = [];
  let config;

  try {
    config = await loadLocalConfig(configPath);

    checks.push(
      createCheck(
        "config",
        "passed",
        "Config version, provider declaration, execution settings, defaults, and path isolation verified."
      )
    );
  } catch (error) {
    return {
      status: "blocked",
      checks: [
        createCheck(
          "config",
          "failed",
          error.message
        )
      ],
      provider: null,
      zeroBudget: {
        status: "UNVERIFIED",
        reason:
          "Configuration could not be loaded or validated."
      },
      readyForStandalone: false
    };
  }

  const providerMetadata =
    createProviderMetadata(config);

  checks.push(
    createCheck(
      "provider",
      LOCAL_CONFIG_CAPABILITIES
        .implementedProviders
        .includes(config.provider.id)
        ? "passed"
        : "failed",
      LOCAL_CONFIG_CAPABILITIES
        .implementedProviders
        .includes(config.provider.id)
        ? `Provider ${config.provider.id} is implemented and selected.`
        : `Provider ${config.provider.id} is not implemented.`,
      {
        providerId: config.provider.id,
        model: config.provider.model
      }
    )
  );

  checks.push(
    createCheck(
      "provider_runtime_mode",
      providerMetadata.offlineCapable
        ? "passed"
        : "warning",
      providerMetadata.offlineCapable
        ? `Provider ${config.provider.id} supports offline operation.`
        : `Provider ${config.provider.id} requires network access and is not offline capable.`,
      {
        networkRequired:
          providerMetadata.networkRequired,
        offlineCapable:
          providerMetadata.offlineCapable
      }
    )
  );

  checks.push(
    createCheck(
      "zero_budget_core_mode",
      providerMetadata.zeroBudgetCoreMode === "IMPLEMENTED"
        ? "passed"
        : "warning",
      providerMetadata.zeroBudgetCoreMode === "IMPLEMENTED"
        ? "Zero-budget core operating mode is implemented."
        : "Zero-budget local-model core operating mode is not yet implemented.",
      {
        maturity:
          providerMetadata.zeroBudgetCoreMode
      }
    )
  );

  const major = Number(
    process.versions.node.split(".")[0]
  );

  checks.push(
    createCheck(
      "node",
      major >= 22 ? "passed" : "failed",
      `Node ${process.version}; required >=22.`
    )
  );

  const runner =
    options.processAdapter?.run ?? run;

  const git = await runner(
    "git",
    ["--version"],
    {
      timeoutMs: 10000
    }
  );

  checks.push(
    createCheck(
      "git",
      git.code === 0 ? "passed" : "failed",
      git.code === 0
        ? git.stdout.trim()
        : "Git unavailable."
    )
  );

  const dockerExecutable =
    options.dockerExecutable ??
    (
      process.platform === "win32"
        ? path.join(
          process.env.ProgramFiles ??
            "C:\\Program Files",
          "Docker",
          "Docker",
          "resources",
          "bin",
          "docker.exe"
        )
        : "/usr/bin/docker"
    );

  let docker;

  try {
    await access(dockerExecutable);

    docker = await runner(
      dockerExecutable,
      [
        "info",
        "--format",
        "{{.ServerVersion}}"
      ],
      {
        timeoutMs: 10000
      }
    );
  } catch {
    docker = {
      code: null,
      stdout: "",
      stderr: "Docker executable unavailable."
    };
  }

  checks.push(
    createCheck(
      "container",
      docker.code === 0
        ? "passed"
        : config.execution.requireContainer
          ? "failed"
          : "warning",
      docker.code === 0
        ? `Docker daemon ${docker.stdout.trim()}.`
        : "Docker daemon unavailable.",
      {
        required:
          config.execution.requireContainer,
        executionProfile:
          config.execution.profile,
        image:
          config.execution.image
      }
    )
  );

  for (
    const [name, directory]
    of Object.entries(config.roots)
  ) {
    let canonical = null;

    try {
      canonical = await realpath(directory);
    } catch {
      canonical = null;
    }

    const available =
      canonical &&
      await writable(canonical);

    checks.push(
      createCheck(
        `root_${name}`,
        available ? "passed" : "failed",
        available
          ? canonical
          : canonical ??
            `Missing root: ${directory}`
      )
    );
  }

  let secretStatus;
  if (config.provider.secretProvider === "none") {
    secretStatus = { provider: "none", reference: "", available: true, value: "[REDACTED]" };
  } else {
    const secretProvider = createSecretProvider(config, options);
    try { secretStatus = await secretProvider.status(config.provider.secretReference); }
    catch (error) { secretStatus = { provider: config.provider.secretProvider, reference: config.provider.secretReference, available: false, value: "[REDACTED]", error: error.message }; }
  }

  checks.push(
    createCheck(
      "provider_secret",
      secretStatus.available
        ? "passed"
        : "failed",
      `${secretStatus.reference}: ${
        secretStatus.available
          ? "available"
          : "missing"
      }; value [REDACTED].`,
      {
        secretProvider:
          config.provider.secretProvider,
        secretReference:
          config.provider.secretReference
      }
    )
  );

  checks.push(
    createCheck(
      "model",
      config.provider.model
        ? "passed"
        : "failed",
      config.provider.model ||
        "Explicit model missing.",
      {
        providerId:
          config.provider.id
      }
    )
  );

  const failed = checks.some(
    (item) => item.status === "failed"
  );

  const warnings = checks.some(
    (item) => item.status === "warning"
  );

  return {
    status: failed
      ? "blocked"
      : warnings
        ? "ready_with_warnings"
        : "ready",
    checks,
    provider: providerMetadata,
    zeroBudget: {
      status:
        providerMetadata.zeroBudgetCoreMode ===
        "IMPLEMENTED"
          ? "VERIFIED"
          : "UNVERIFIED",
      reason:
        providerMetadata.zeroBudgetCoreMode ===
        "IMPLEMENTED"
          ? "A zero-budget local operating mode is implemented."
          : "The currently implemented OpenAI provider requires network access and credentials; local zero-budget runtime remains planned."
    },
    readyForStandalone: !failed
  };
}
