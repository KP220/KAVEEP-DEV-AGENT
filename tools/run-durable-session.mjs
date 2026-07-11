import { readFile } from "node:fs/promises";
import path from "node:path";
import { LlmAdapterRegistry, OpenAIResponsesAdapter } from "../src/brain/engineering-brain.mjs";
import { cancelDurableSession, createDurableSessionStore, persistStandaloneSession, recoverDurableSession, replayDurableSession } from "../src/persistence/durable-session-store.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const [command, storeArg, valueArg] = process.argv.slice(2);
if (!command || !storeArg || !["start", "replay", "recover", "cancel"].includes(command)) {
  console.error("วิธีใช้:\n  npm run session:durable -- start <store> <request.json>\n  npm run session:durable -- replay <store> <session-id>\n  npm run session:durable -- recover <store> <session-id>\n  npm run session:durable -- cancel <store> <session-id>");
  process.exit(2);
}
const store = path.resolve(storeArg);
function registry() {
  if (!process.env.OPENAI_API_KEY) throw new Error("กรุณาตั้ง OPENAI_API_KEY ใน environment ก่อน start/recover");
  return new LlmAdapterRegistry().register("openai", new OpenAIResponsesAdapter({ apiKey: process.env.OPENAI_API_KEY }));
}
async function verifiedRequest(file) {
  const request = JSON.parse(await readFile(path.resolve(file), "utf8"));
  const schemaPath = path.resolve("schemas/standalone-session-request.schema.json"); const schema = await loadSchema(schemaPath); const errors = [];
  await validateValue(request, schema, { schemaPath, rootSchema: schema }, "$", errors);
  if (errors.length) throw new Error(`Request ไม่ผ่าน schema:\n${errors.join("\n")}`);
  return request;
}
let output;
if (command === "start") {
  if (!valueArg) throw new Error("start requires request.json");
  await createDurableSessionStore(store);
  const request = await verifiedRequest(valueArg);
  const proposalSchema = await loadSchema(path.resolve("schemas/engineering-proposal.schema.json"));
  output = await persistStandaloneSession(store, request, registry(), { proposalSchema });
} else if (command === "replay") output = await replayDurableSession(store, valueArg);
else if (command === "recover") {
  const proposalSchema = await loadSchema(path.resolve("schemas/engineering-proposal.schema.json"));
  output = await recoverDurableSession(store, valueArg, registry(), { proposalSchema });
} else output = await cancelDurableSession(store, valueArg);
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (["blocked", "corrupted", "failed"].includes(output.status)) process.exitCode = 1;
