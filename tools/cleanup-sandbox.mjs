import { cleanupSecureSandbox } from "../src/sandbox/secure-sandbox-manager.mjs";

try {
  const result = await cleanupSecureSandbox(process.argv[2]);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch (error) {
  process.stderr.write(JSON.stringify({ status:"blocked", error:error.message }, null, 2) + "\n");
  process.exitCode = 1;
}
