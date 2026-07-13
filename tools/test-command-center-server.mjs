import assert from "node:assert/strict";
import { createCommandCenterServer } from "../src/app/command-center-server.mjs";

const server = createCommandCenterServer({
  askSession: async (command, { eventSink }) => {
    assert.equal(command, "inspect the repository");
    await eventSink({ event: { state: "analyzing", sequence: 1 } });
    await eventSink({ event: { state: "awaiting_approval", sequence: 2 } });
    return {
      status: "awaiting_approval",
      durable: {
        record: { durableSessionId: "stream_test_001" },
        result: { state: "awaiting_approval" }
      }
    };
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const root = `http://127.0.0.1:${server.address().port}`;
try {
  const avatar = await fetch(`${root}/kaveep-avatar.png`);
  assert.equal(avatar.status, 200);
  assert.equal(avatar.headers.get("content-type"), "image/png");
  const missing = await fetch(`${root}/api/ask/stream`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error, "Command is required.");
  const streamed = await fetch(`${root}/api/ask/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: "inspect the repository" })
  });
  assert.equal(streamed.status, 200);
  assert.match(streamed.headers.get("content-type"), /text\/event-stream/);
  const frames = (await streamed.text()).trim().split("\n\n");
  assert.equal(frames.length, 3);
  assert.match(frames[0], /event: progress/);
  assert.match(frames[0], /"state":"analyzing"/);
  assert.match(frames[1], /"state":"awaiting_approval"/);
  assert.match(frames[2], /event: result/);
  assert.match(frames[2], /"sessionId":"stream_test_001"/);
  console.log("PASSED command center SSE progress, result, validation, and avatar endpoint");
} finally { await new Promise((resolve) => server.close(resolve)); }
