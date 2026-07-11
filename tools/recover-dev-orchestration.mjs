import { recoverDurableRun } from "../src/persistence/durable-orchestration-store.mjs";
const [storeRoot,runId]=process.argv.slice(2); if(!storeRoot||!runId) throw new Error("Usage: node tools/recover-dev-orchestration.mjs <store-root> <run-id>");
const result=await recoverDurableRun(storeRoot,runId); process.stdout.write(JSON.stringify(result,null,2)+"\n"); if(result.status!=="restarted_from_received") process.exitCode=1;
