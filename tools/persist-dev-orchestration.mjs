import { readFile } from "node:fs/promises"; import path from "node:path";
import { createDurableStore, persistReadOnlyOrchestration } from "../src/persistence/durable-orchestration-store.mjs";
const [storeRoot,repositoryRoot,snapshotPath,missionLockPath,...commandParts]=process.argv.slice(2);
if(!storeRoot||!repositoryRoot||!snapshotPath||!missionLockPath||!commandParts.length) throw new Error("Usage: node tools/persist-dev-orchestration.mjs <store-root> <repository-root> <snapshot.json> <mission-lock.json> <command>");
const json=async p=>JSON.parse(await readFile(path.resolve(p),"utf8")); await createDurableStore(storeRoot);
const result=await persistReadOnlyOrchestration(storeRoot,{repositoryRoot,authoritySnapshot:await json(snapshotPath),missionLock:await json(missionLockPath),command:commandParts.join(" ")});
process.stdout.write(JSON.stringify(result,null,2)+"\n");
