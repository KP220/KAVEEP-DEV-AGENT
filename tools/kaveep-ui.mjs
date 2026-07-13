import { serveCommandCenter } from "../src/app/command-center-server.mjs";
const args = process.argv.slice(2); let host = "127.0.0.1", port = 8765;
for (let index = 0; index < args.length; index += 1) { if (args[index] === "--host") host = args[++index]; else if (args[index] === "--port") port = Number(args[++index]); else throw new Error(`Unknown ui option: ${args[index]}`); }
const started = await serveCommandCenter({ host, port }); process.stdout.write(`KAVEEP Command Center: ${started.url}\n`);
