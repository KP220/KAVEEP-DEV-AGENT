import { inspectRepository } from "../src/repository/repository-intelligence.mjs";

const repositoryRoot = process.argv[2];
const report = await inspectRepository(repositoryRoot);

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (["blocked", "unsupported", "no_action", "unverified"].includes(report.status)) {
  process.exitCode = 1;
}
