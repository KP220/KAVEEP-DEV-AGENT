import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { configureSecretReference, createLocalConfig, loadLocalConfig, SecretValue } from "../src/config/local-config.mjs";
import { runEnvironmentDoctor } from "../src/config/environment-doctor.mjs";
import { WindowsDpapiSecretProvider } from "../src/config/windows-dpapi-secret-provider.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "kaveep-dpapi-test-")); const repo = path.join(root, "repo"), data = path.join(root, "data"), configPath = path.join(root, "config.json"), reference = path.join(data, "secrets", "key.dpapi"); const secret = "sk-dpapi-test-secret-never-persist-123456";
try {
  await mkdir(repo); await createLocalConfig({ configPath, repositoryRoot: repo, dataRoot: data, model: "explicit-model" });
  const adapter = { async run({ kind, input }) { if (kind === "protect") return { code: 0, stdout: Buffer.from(`protected:${input}`, "utf8").toString("base64"), stderr: "" }; const decoded = Buffer.from(input, "base64").toString("utf8"); return { code: 0, stdout: decoded.replace(/^protected:/, ""), stderr: "" }; } };
  const provider = new WindowsDpapiSecretProvider({ processAdapter: adapter }); const ciphertext = await provider.protect(new SecretValue(secret)); await mkdir(path.dirname(reference), { recursive: true }); await writeFile(reference, `${ciphertext}\n`, { flag: "wx", mode: 0o600 }); await configureSecretReference(configPath, "windows-dpapi", reference);
  assert.equal((await provider.resolve(reference)).reveal(), secret); assert.equal((await provider.status(reference)).available, true); assert.equal(JSON.stringify(provider).includes(secret), false); assert.equal((await readFile(reference, "utf8")).includes(secret), false); assert.equal((await readFile(configPath, "utf8")).includes(secret), false); assert.equal((await loadLocalConfig(configPath)).provider.secretProvider, "windows-dpapi");
  const doctorRunner = { async run(file) { return String(file).toLowerCase().includes("git") ? { code: 0, stdout: "git test", stderr: "" } : { code: 0, stdout: "29", stderr: "" }; } }; const doctor = await runEnvironmentDoctor(configPath, { processAdapter: doctorRunner, dockerExecutable: process.execPath, dpapiOptions: { processAdapter: adapter } }); assert.equal(doctor.readyForStandalone, true); assert.equal(JSON.stringify(doctor).includes(secret), false); assert(JSON.stringify(doctor).includes("[REDACTED]"));
  await writeFile(reference, "not valid ciphertext"); await assert.rejects(() => provider.resolve(reference), /ciphertext file is invalid/);
  console.log("PASSED Windows DPAPI boundary; stdin-style adapter; ciphertext-only persistence; config/doctor integration; plaintext redacted");
} finally { await rm(root, { recursive: true, force: true }); }
