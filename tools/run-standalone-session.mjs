import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { LlmAdapterRegistry, OpenAIResponsesAdapter } from "../src/brain/engineering-brain.mjs";
import { runStandaloneSession } from "../src/session/standalone-engineering-session.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const requestPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : null;
if (!requestPath) {
  console.error("วิธีใช้: npm run session:run -- <request.json> [result.json]");
  process.exitCode = 2;
} else {
  const request = JSON.parse(await readFile(requestPath, "utf8"));
  const schemaPath = path.resolve("schemas/standalone-session-request.schema.json");
  const schema = await loadSchema(schemaPath);
  const errors = [];
  await validateValue(request, schema, { schemaPath, rootSchema: schema }, "$", errors);
  if (errors.length) throw new Error(`Standalone Session Request ไม่ผ่าน schema:\n${errors.join("\n")}`);
  if (request.brain.providerId !== "openai") throw new Error(`CLI ยังไม่รองรับ provider: ${request.brain.providerId}`);
  if (!process.env.OPENAI_API_KEY) throw new Error("กรุณาตั้ง OPENAI_API_KEY ใน environment ก่อนเริ่ม session");

  const registry = new LlmAdapterRegistry().register("openai", new OpenAIResponsesAdapter({ apiKey: process.env.OPENAI_API_KEY }));
  const proposalSchema = await loadSchema(path.resolve("schemas/engineering-proposal.schema.json"));
  const result = await runStandaloneSession(request, registry, { proposalSchema });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) {
    await writeFile(outputPath, serialized, { encoding: "utf8", flag: "wx" });
    console.log(`บันทึกผลลัพธ์แล้ว: ${outputPath}`);
  } else {
    process.stdout.write(serialized);
  }
  if (!["awaiting_approval", "no_action"].includes(result.status)) process.exitCode = 1;
}
