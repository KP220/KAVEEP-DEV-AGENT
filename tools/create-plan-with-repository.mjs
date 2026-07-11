import { interpretEngineeringCommand } from "../src/interpreter/thai-command-interpreter.mjs";
import { createEngineeringPlan } from "../src/planning/planning-engine.mjs";
import { inspectRepository } from "../src/repository/repository-intelligence.mjs";

const repositoryRoot = process.argv[2];
const command = process.argv.slice(3).join(" ");

const repositoryIntelligence = await inspectRepository(repositoryRoot);

if (["blocked", "unsupported", "no_action", "unverified"].includes(repositoryIntelligence.status)) {
  process.stdout.write(`${JSON.stringify({ repositoryIntelligence }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  const request = interpretEngineeringCommand(command);
  const plan = createEngineeringPlan(request, { repositoryIntelligence });
  process.stdout.write(`${JSON.stringify({ repositoryIntelligence, request, plan }, null, 2)}\n`);
}
