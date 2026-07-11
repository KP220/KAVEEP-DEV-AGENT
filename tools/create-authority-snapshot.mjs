import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAuthoritySnapshot } from "../src/governance/authority-governance.mjs";

const [repositoryRoot, configPath] = process.argv.slice(2);
if (!repositoryRoot || !configPath) throw new Error("Usage: node tools/create-authority-snapshot.mjs <repository-root> <authority-config.json>");
const config = JSON.parse(await readFile(path.resolve(configPath), "utf8"));
const snapshot = await createAuthoritySnapshot(repositoryRoot, config.documents, { snapshotId: config.snapshotId, maxFileBytes: config.maxFileBytes });
process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);

