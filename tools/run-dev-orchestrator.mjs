import { readFile } from "node:fs/promises";
import path from "node:path";
import { runReadOnlyOrchestration } from "../src/orchestration/dev-orchestrator.mjs";

const [repositoryRoot, snapshotPath, missionLockPath, ...commandParts] = process.argv.slice(2);
if (!repositoryRoot || !snapshotPath || !missionLockPath || commandParts.length === 0) {
  throw new Error("Usage: node tools/run-dev-orchestrator.mjs <repository-root> <snapshot.json> <mission-lock.json> <command>");
}
const readJson = async (filePath) => JSON.parse(await readFile(path.resolve(filePath), "utf8"));
const result = await runReadOnlyOrchestration({
  repositoryRoot,
  authoritySnapshot: await readJson(snapshotPath),
  missionLock: await readJson(missionLockPath),
  command: commandParts.join(" ")
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!new Set(["completed", "completed_with_warnings", "no_action"]).has(result.status)) process.exitCode = 1;

