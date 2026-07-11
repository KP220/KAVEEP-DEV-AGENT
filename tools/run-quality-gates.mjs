import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const gates = [
  ["contract examples", "tools/validate-examples.mjs"],
  ["Thai Command Interpreter", "tools/test-interpreter.mjs"],
  ["Planning Engine", "tools/test-planning-engine.mjs"],
  ["Repository Intelligence", "tools/test-repository-intelligence.mjs"],
  ["Context Builder", "tools/test-context-builder.mjs"],
  ["Execution Gate", "tools/test-execution-gate.mjs"],
  ["Tool Orchestrator", "tools/test-tool-orchestrator.mjs"],
  ["Secure Sandbox", "tools/test-secure-sandbox.mjs"],
  ["Sandbox File Editor", "tools/test-sandbox-file-editor.mjs"],
  ["Authority Governance", "tools/test-authority-governance.mjs"],
  ["DEV-Orchestrator", "tools/test-dev-orchestrator.mjs"],
  ["Durable Orchestration Store", "tools/test-durable-orchestration-store.mjs"],
  ["Sandbox Static Validation", "tools/test-static-validation-runner.mjs"],
  ["Engineering Brain", "tools/test-engineering-brain.mjs"],
  ["Iterative Engineering Loop", "tools/test-iterative-engineering-loop.mjs"],
  ["Reviewed Change Artifact", "tools/test-reviewed-change-generator.mjs"],
  ["Change Approval Verification", "tools/test-change-approval-verifier.mjs"],
  ["Controlled Source Write", "tools/test-controlled-source-writer.mjs"],
  ["Durable Write Recovery", "tools/test-durable-write-transaction.mjs"],
  ["Container Validation", "tools/test-container-validation-runner.mjs"],
  ["Standalone Engineering Session", "tools/test-standalone-engineering-session.mjs"],
  ["Durable Standalone Session", "tools/test-durable-session-store.mjs"],
  ["Persistent Workspace Index", "tools/test-workspace-index.mjs"],
  ["Local Review Workflow", "tools/test-local-review-workflow.mjs"],
  ["Controlled Local Git", "tools/test-controlled-git-workflow.mjs"],
  ["Git Operation Classifier", "tools/test-git-operation-classifier.mjs"],
  ["Local Config and Doctor", "tools/test-local-config-doctor.mjs"],
  ["Standalone App Surface", "tools/test-standalone-app.mjs"],
  ["Production Soak", "tools/test-production-soak.mjs"],
  ["Release Readiness", "tools/test-release-readiness.mjs"],
  ["Windows DPAPI Secret Store", "tools/test-windows-dpapi-secret-provider.mjs"],
  ["Dynamic Engineering Loop", "tools/test-dynamic-engineering-loop.mjs"]
];

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repoRoot, script)], {
      cwd: repoRoot,
      stdio: "inherit",
      windowsHide: true
    });

    child.once("error", reject);

    child.once("exit", (code, signal) => {
      if (code === 0) {
        return resolve();
      }

      reject(
        new Error(
          `${script} failed${
            signal ? ` with signal ${signal}` : ` with exit code ${code}`
          }.`
        )
      );
    });
  });
}

for (const [name, script] of gates) {
  console.log(`\nQUALITY_GATE ${name}`);
  await run(script);
}

console.log(`\nPASSED ${gates.length} quality gates`);
