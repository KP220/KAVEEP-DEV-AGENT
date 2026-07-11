import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SecretValue } from "../src/config/local-config.mjs";
import { WindowsDpapiSecretProvider } from "../src/config/windows-dpapi-secret-provider.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "kaveep-dpapi-cert-")); const reference = path.join(root, "probe.dpapi"); const plaintext = `kaveep-dpapi-probe-${randomBytes(24).toString("hex")}`;
try { const provider = new WindowsDpapiSecretProvider(); const ciphertext = await provider.protect(new SecretValue(plaintext)); await writeFile(reference, `${ciphertext}\n`, { flag: "wx", mode: 0o600 }); const recovered = (await provider.resolve(reference)).reveal(); const disk = await readFile(reference, "utf8"); const certified = recovered === plaintext && !disk.includes(plaintext) && /^[A-Za-z0-9+/=]+\s*$/.test(disk); const report = { certificationId: "windows_dpapi_current_user_live", status: certified ? "certified" : "failed", plaintextPersisted: disk.includes(plaintext), roundTripVerified: recovered === plaintext, providerSerializedRedacted: !JSON.stringify(provider).includes(plaintext), certifiedAt: new Date().toISOString() }; process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); if (!certified) process.exitCode = 1; } finally { await rm(root, { recursive: true, force: true }); }
