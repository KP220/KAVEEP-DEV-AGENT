import { access, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const defaults = { binaryRoot: path.join(os.homedir(), "Desktop", "llama-b9963-bin-win-cpu-x64"), modelsRoot: "C:\\KAVEEP\\models", host: "127.0.0.1", port: 8080, alias: "kaveep-local", ctx: 8192 };
async function exists(file) { try { await access(file); return true; } catch { return false; } }
async function findModel(root) { if (!await exists(root)) return null; const found = []; for (const item of await readdir(root, { withFileTypes: true })) { const target = path.join(root, item.name); if (item.isFile() && item.name.toLowerCase().endsWith(".gguf")) found.push({ target, size: (await stat(target)).size }); } return found.sort((a,b) => b.size - a.size)[0]?.target ?? null; }
export async function resolveLlamaCppLaunch(options = {}) { const value = { ...defaults, ...options }; const server = path.join(path.resolve(value.binaryRoot), "llama-server.exe"); if (!await exists(server)) throw new Error(`llama-server.exe not found: ${server}`); const model = value.model ? path.resolve(value.model) : await findModel(value.modelsRoot); if (!model || !await exists(model)) throw new Error("No .gguf model found; pass --model or place one in C:\\KAVEEP\\models."); return { server, args: ["--model", model, "--host", value.host, "--port", String(value.port), "--alias", value.alias, "--ctx-size", String(value.ctx), "--no-agent", "--no-ui-mcp-proxy"], url: `http://${value.host}:${value.port}/v1`, model: value.alias }; }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { const launch = await resolveLlamaCppLaunch(); process.stdout.write(`${JSON.stringify(launch)}\n`); spawn(launch.server, launch.args, { cwd: path.dirname(launch.server), stdio: "inherit", windowsHide: false }); }
