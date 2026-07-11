import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCapabilityManifest } from "../src/capabilities/capability-manifest-validator.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

try {
  const result = await validateCapabilityManifest({ repoRoot });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.blocking ? 1 : 0;
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown validation failure.";

  const result = {
    schemaVersion: "1.0.0",
    status: "INVALID",
    repository: "KAVEEP-DEV-AGENT",
    manifestPath: "capabilities/repository-capability-manifest.json",
    errors: [
      {
        code: "ERR_VALIDATOR_RUNTIME",
        message,
        path: "$",
        capabilityId: null,
        blocking: true
      }
    ],
    drift: [],
    limitations: [],
    evidenceInspected: [],
    capabilitiesInspected: [],
    blocking: true
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = 1;
}
