import { interpretEngineeringCommand } from "../src/interpreter/thai-command-interpreter.mjs";

const command = process.argv.slice(2).join(" ");
const request = interpretEngineeringCommand(command);

process.stdout.write(`${JSON.stringify(request, null, 2)}\n`);
