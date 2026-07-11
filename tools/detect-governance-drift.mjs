import { readFile } from "node:fs/promises";
import path from "node:path";
import { detectGovernanceDrift } from "../src/governance/authority-governance.mjs";

const [snapshotPath, missionLockPath, proposedChangesPath] = process.argv.slice(2);
if (!snapshotPath || !missionLockPath) throw new Error("Usage: node tools/detect-governance-drift.mjs <snapshot.json> <mission-lock.json> [proposed-changes.json]");
const readJson = async (filePath) => JSON.parse(await readFile(path.resolve(filePath), "utf8"));
const snapshot = await readJson(snapshotPath);
const missionLock = await readJson(missionLockPath);
const proposedChanges = proposedChangesPath ? await readJson(proposedChangesPath) : [];
const result = await detectGovernanceDrift(snapshot, missionLock, { proposedChanges });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.status !== "aligned") process.exitCode = 1;

