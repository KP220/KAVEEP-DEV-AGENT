import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, realpath, rename } from "node:fs/promises";
import path from "node:path";
import { isInsideRoot } from "../repository/repository-intelligence.mjs";

const forbidden = /(secret|token|password|credential|authorization|api.?key)/i;
const permittedReferenceKeys = new Set(["secretProvider", "secretReference", "maxOutputTokens"]);
function rejectSecrets(value, location = "$") { if (Array.isArray(value)) return value.forEach((item, index) => rejectSecrets(item, `${location}[${index}]`)); if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) { if (forbidden.test(key) && !permittedReferenceKeys.has(key)) throw new Error(`Config contains forbidden secret-like key: ${location}.${key}`); rejectSecrets(child, `${location}.${key}`); } }
async function atomic(file, value) { const temporary = `${file}.${randomUUID()}.tmp`; await mkdir(path.dirname(file), { recursive: true }); const handle = await open(temporary, "wx", 0o600); try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`); await handle.sync(); } finally { await handle.close(); } await rename(temporary, file); }
export async function createLocalConfig({ configPath, repositoryRoot, dataRoot, model, executionProfile = "node", image = "node:22-bookworm-slim" }, options = {}) {
  const repository = await realpath(path.resolve(repositoryRoot)); await mkdir(path.resolve(dataRoot), { recursive: true }); const data = await realpath(path.resolve(dataRoot));
  if (isInsideRoot(repository, data) || isInsideRoot(data, repository)) throw new Error("Data root and repository must be isolated from each other.");
  if (!model || !executionProfile || !["node", "python", "go", "rust"].includes(executionProfile) || !image) throw new Error("Explicit model, supported profile, and image are required.");
  const roots = { sessions: path.join(data, "sessions"), workspaceIndex: path.join(data, "workspace-index"), approvals: path.join(data, "approval-ledger"), transactions: path.join(data, "transactions"), writes: path.join(data, "write-ledger"), gitApprovals: path.join(data, "git-approval-ledger") }; for (const directory of Object.values(roots)) await mkdir(directory, { recursive: true });
  const config = { configVersion: "1.0.0", repositoryRoot: repository, dataRoot: data, roots, provider: { id: "openai", model, secretProvider: "environment", secretReference: "OPENAI_API_KEY" }, execution: { profile: executionProfile, image, allowedImages: [image], requireContainer: true }, defaults: { maxContextCharacters: 100000, maxOutputTokens: 8000, maxEdits: 20, maxAttempts: 3, semanticMaxAttempts: 2 }, createdAt: (options.clock?.() ?? new Date()).toISOString() };
  rejectSecrets(config); await atomic(path.resolve(configPath), config); return config;
}
export async function loadLocalConfig(configPath) { const config = JSON.parse(await readFile(path.resolve(configPath), "utf8")); rejectSecrets(config); if (config.configVersion !== "1.0.0") throw new Error("Unsupported local config version."); const repository = await realpath(config.repositoryRoot); const data = await realpath(config.dataRoot); if (isInsideRoot(repository, data) || isInsideRoot(data, repository)) throw new Error("Configured data/repository isolation is invalid."); return config; }

export class EnvironmentSecretProvider {
  #environment;
  constructor(environment = process.env) { this.#environment = environment; Object.freeze(this); }
  status(reference) { const value = this.#environment[reference]; return { provider: "environment", reference, available: typeof value === "string" && value.length > 0, value: "[REDACTED]" }; }
  resolve(reference) { const value = this.#environment[reference]; if (!value) throw new Error(`Required environment secret is unavailable: ${reference}`); return new SecretValue(value); }
  toJSON() { return { provider: "environment", value: "[REDACTED]" }; }
}
export class SecretValue { #value; constructor(value) { this.#value = value; Object.freeze(this); } reveal() { return this.#value; } toJSON() { return "[REDACTED]"; } toString() { return "[REDACTED]"; } }

export async function configureSecretReference(configPath, provider, reference) {
  if (!new Set(["environment", "windows-dpapi"]).has(provider) || !reference) throw new Error("Unsupported secret provider or reference.");
  const config = await loadLocalConfig(configPath); config.provider.secretProvider = provider; config.provider.secretReference = provider === "windows-dpapi" ? path.resolve(reference) : reference; rejectSecrets(config); await atomic(path.resolve(configPath), config); return config;
}
