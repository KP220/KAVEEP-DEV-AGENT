import path from "node:path";
import { buildWorkspaceIndex, searchWorkspaceIndex } from "../src/repository/workspace-index.mjs";

const [command, first, second, ...rest] = process.argv.slice(2);
if (!command || !["build", "search"].includes(command) || !first || !second) {
  console.error("วิธีใช้:\n  npm run index:workspace -- build <repository> <index-store>\n  npm run index:workspace -- search <index-store> <query>");
  process.exit(2);
}
const result = command === "build"
  ? await buildWorkspaceIndex(path.resolve(first), path.resolve(second))
  : await searchWorkspaceIndex(path.resolve(first), [second, ...rest].join(" "));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (["stale"].includes(result.status)) process.exitCode = 1;
