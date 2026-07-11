import { interpretEngineeringCommand } from "../src/interpreter/thai-command-interpreter.mjs";
import { createEngineeringPlan } from "../src/planning/planning-engine.mjs";

const command = process.argv.slice(2).join(" ");
const request = interpretEngineeringCommand(command);
const plan = createEngineeringPlan(request);

process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
