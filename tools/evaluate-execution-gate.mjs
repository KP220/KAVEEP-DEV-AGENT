import { readFile } from "node:fs/promises";
import { evaluateExecutionGate } from "../src/gates/execution-gate.mjs";
const [planPath, requestPath] = process.argv.slice(2);
const result = evaluateExecutionGate(JSON.parse(await readFile(planPath,"utf8")),JSON.parse(await readFile(requestPath,"utf8")));
process.stdout.write(JSON.stringify(result,null,2)+"\n");
if(result.decision!=="allow_read_only") process.exitCode=1;
