import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadLocalConfig } from "../src/config/local-config.mjs";
import { evaluateLocalModel } from "../src/evaluation/local-model-evaluator.mjs";

const [configPath, authorityPath, missionPath, ...words] = process.argv.slice(2);
if (!configPath || !authorityPath || !missionPath || !words.length) throw new Error("Usage: node tools/evaluate-local-model.mjs <config.json> <authority.json> <mission.json> <task...>");
const [config, authoritySnapshot, missionLock, proposalSchema] = await Promise.all([loadLocalConfig(path.resolve(configPath)), readFile(path.resolve(authorityPath), "utf8").then(JSON.parse), readFile(path.resolve(missionPath), "utf8").then(JSON.parse), readFile(path.resolve("schemas/engineering-proposal.schema.json"), "utf8").then(JSON.parse)]);
const report = await evaluateLocalModel({ config, authoritySnapshot, missionLock, command: words.join(" "), proposalSchema });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== "completed") process.exitCode = 1;
