import assert from "node:assert/strict";
import { createCommandCenterServer } from "../src/app/command-center-server.mjs";

const server = createCommandCenterServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const root = `http://127.0.0.1:${server.address().port}`;
try {
  const avatar = await fetch(`${root}/kaveep-avatar.png`);
  assert.equal(avatar.status, 200);
  assert.equal(avatar.headers.get("content-type"), "image/png");
  const missing = await fetch(`${root}/api/ask/stream`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error, "Command is required.");
  console.log("PASSED command center streaming boundary and avatar endpoint");
} finally { await new Promise((resolve) => server.close(resolve)); }
