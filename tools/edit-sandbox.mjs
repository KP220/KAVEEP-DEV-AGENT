import { readFile } from "node:fs/promises";
import { editSandbox } from "../src/sandbox/sandbox-file-editor.mjs";

const [manifestPath, operationsPath] = process.argv.slice(2);
if (!manifestPath || !operationsPath) { console.error("Usage: npm.cmd run sandbox:edit -- <sandbox-manifest.json> <operations.json>"); process.exitCode=1; }
else {
  try { const operations=JSON.parse(await readFile(operationsPath,"utf8")); console.log(JSON.stringify(await editSandbox(manifestPath,operations),null,2)); }
  catch (error) { console.error(error.message); process.exitCode=1; }
}
