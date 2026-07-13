import { spawn } from "node:child_process";
import { request } from "node:http";
import { serveCommandCenter } from "../src/app/command-center-server.mjs";
import { resolveLlamaCppLaunch } from "./kaveep-local-llm.mjs";

const noOpen = process.argv.includes("--no-open");
const health = (url) => new Promise((resolve) => { const req = request(url, { timeout: 1500 }, (res) => { res.resume(); resolve(res.statusCode === 200); }); req.on("error", () => resolve(false)); req.on("timeout", () => { req.destroy(); resolve(false); }); req.end(); });
// Keep the default combined-start footprint suitable for the bundled 3B CPU model.
const launch = await resolveLlamaCppLaunch({ ctx: 4096 });
let modelProcess = null;
if (!await health(`${launch.url}/models`)) {
  modelProcess = spawn(launch.server, launch.args, { cwd: launch.server.slice(0, launch.server.lastIndexOf("\\")), windowsHide: true, stdio: "ignore" });
  for (let attempt = 0; attempt < 120 && !await health(`${launch.url}/models`); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 500));
  if (!await health(`${launch.url}/models`)) { modelProcess.kill(); throw new Error("Local model did not become ready within 60 seconds."); }
}
const commandCenter = await serveCommandCenter({ host: "127.0.0.1", port: 8765 });
process.stdout.write(`KAVEEP ready\nModel: ${launch.url}\nCommand Center: ${commandCenter.url}\nPress Ctrl+C to stop.\n`);
if (!noOpen && process.platform === "win32") spawn("cmd", ["/c", "start", "", commandCenter.url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
const shutdown = () => { commandCenter.server.close(() => process.exit(0)); if (modelProcess && !modelProcess.killed) modelProcess.kill(); };
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
