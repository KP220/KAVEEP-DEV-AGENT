import { interpretEngineeringCommand } from "../src/interpreter/thai-command-interpreter.mjs";
import { inspectRepository } from "../src/repository/repository-intelligence.mjs";
import { buildEngineeringContext } from "../src/context/context-builder.mjs";

const repositoryRoot = process.argv[2];
const command = process.argv.slice(3).join(" ");

const request = interpretEngineeringCommand(command);
const repositoryIntelligence = await inspectRepository(repositoryRoot);
const engineeringContext = buildEngineeringContext(request, repositoryIntelligence);

process.stdout.write(`${JSON.stringify(engineeringContext, null, 2)}\n`);

if (["blocked", "unsupported", "no_action", "needs_context", "unverified"].includes(engineeringContext.status)) {
  process.exitCode = 1;
}
