import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { applyLocalApprovalBundle, createLocalApprovalBundle } from "../src/workflow/local-review-workflow.mjs";
import { commitReviewedChange, createGitApprovalBundle } from "../src/git/controlled-git-workflow.mjs";

const json = async (file) => JSON.parse(await readFile(path.resolve(file), "utf8"));
const [command, ...args] = process.argv.slice(2);
if (!command || !["review", "approve", "apply", "git-approve", "git-commit"].includes(command)) {
  console.error("วิธีใช้:\n  npm run workflow:local -- review <session-result.json>\n  npm run workflow:local -- approve <session-result.json> <reviewer-id> <bundle.json>\n  npm run workflow:local -- apply <session-result.json> <session-request.json> <bundle.json> <approval-ledger> <transactions> <write-ledger>\n  npm run workflow:local -- git-approve <session-result.json> <reviewer-id> <git-bundle.json>\n  npm run workflow:local -- git-commit <repository> <session-result.json> <apply-result.json> <git-bundle.json> <git-approval-ledger> <kaveep/branch> <message>");
  process.exit(2);
}
if (command === "review") {
  const result = await json(args[0]); const reviewed = result?.artifacts?.reviewedChange;
  if (result.status !== "awaiting_approval" || reviewed?.status !== "ready_for_review") throw new Error("Session is not ready for review.");
  stdout.write(`${reviewed.patch}\nPATCH_SHA256 ${reviewed.patchSha256}\nCHANGED_PATHS ${reviewed.changes.length}\n`);
} else if (command === "approve") {
  const [resultFile, reviewerId, outputFile] = args; if (!outputFile) throw new Error("approve arguments are incomplete.");
  const secret = process.env.KAVEEP_APPROVAL_SIGNING_SECRET; if (!secret || secret.length < 16) throw new Error("Set KAVEEP_APPROVAL_SIGNING_SECRET to a trusted value of at least 16 characters.");
  const result = await json(resultFile); const reviewed = result?.artifacts?.reviewedChange;
  stdout.write(`\nตรวจ patch ให้ครบก่อนอนุมัติ\nReviewed Change: ${reviewed?.reviewedChangeId}\nPatch SHA-256: ${reviewed?.patchSha256}\nChanged paths: ${reviewed?.changes?.map((item) => item.path).join(", ")}\n\n`);
  if (!stdin.isTTY) throw new Error("Approval requires an interactive terminal; piped confirmation is denied.");
  const prompt = createInterface({ input: stdin, output: stdout });
  const typedConfirmation = await prompt.question("พิมพ์ APPROVE ตามด้วย patch SHA-256 เต็มเพื่อยืนยัน: "); prompt.close();
  const bundle = createLocalApprovalBundle({ reviewedChange: reviewed, reviewerId, typedConfirmation, trustedSecret: secret });
  await writeFile(path.resolve(outputFile), `${JSON.stringify(bundle, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  stdout.write(`สร้าง approval bundle แล้ว: ${path.resolve(outputFile)}\n`);
} else if (command === "apply") {
  const [resultFile, requestFile, bundleFile, approvalLedgerRoot, transactionRoot, writeLedgerRoot] = args;
  if (!writeLedgerRoot) throw new Error("apply arguments are incomplete.");
  const secret = process.env.KAVEEP_APPROVAL_SIGNING_SECRET; if (!secret || secret.length < 16) throw new Error("Set KAVEEP_APPROVAL_SIGNING_SECRET to the same trusted signing value.");
  const outcome = await applyLocalApprovalBundle({ sessionResult: await json(resultFile), sessionRequest: await json(requestFile), bundle: await json(bundleFile), trustedSecret: secret, approvalLedgerRoot: path.resolve(approvalLedgerRoot), transactionRoot: path.resolve(transactionRoot), writeLedgerRoot: path.resolve(writeLedgerRoot) });
  stdout.write(`${JSON.stringify(outcome, null, 2)}\n`); if (outcome.status !== "completed") process.exitCode = 1;
} else if (command === "git-approve") {
  const [resultFile, reviewerId, outputFile] = args; if (!outputFile) throw new Error("git-approve arguments are incomplete.");
  const secret = process.env.KAVEEP_APPROVAL_SIGNING_SECRET; if (!secret || secret.length < 16) throw new Error("Set KAVEEP_APPROVAL_SIGNING_SECRET.");
  const reviewed = (await json(resultFile))?.artifacts?.reviewedChange;
  stdout.write(`Git commit approval is separate from source write approval.\nPatch SHA-256: ${reviewed?.patchSha256}\n`);
  if (!stdin.isTTY) throw new Error("Git approval requires an interactive terminal; piped confirmation is denied.");
  const prompt = createInterface({ input: stdin, output: stdout }); const typedConfirmation = await prompt.question("พิมพ์ COMMIT ตามด้วย patch SHA-256 เต็ม: "); prompt.close();
  const bundle = createGitApprovalBundle({ reviewedChange: reviewed, reviewerId, typedConfirmation, trustedSecret: secret });
  await writeFile(path.resolve(outputFile), `${JSON.stringify(bundle, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 }); stdout.write(`สร้าง Git approval bundle แล้ว: ${path.resolve(outputFile)}\n`);
} else {
  const [repository, resultFile, applyResultFile, bundleFile, approvalLedgerRoot, branchName, commitMessage] = args; if (!commitMessage) throw new Error("git-commit arguments are incomplete.");
  const secret = process.env.KAVEEP_APPROVAL_SIGNING_SECRET; if (!secret || secret.length < 16) throw new Error("Set KAVEEP_APPROVAL_SIGNING_SECRET.");
  const session = await json(resultFile); const applyResult = await json(applyResultFile); const writeResult = applyResult.transaction?.writeResult ?? applyResult.writeResult;
  const outcome = await commitReviewedChange({ repositoryRoot: path.resolve(repository), reviewedChange: session.artifacts.reviewedChange, writeResult, bundle: await json(bundleFile), trustedSecret: secret, approvalLedgerRoot: path.resolve(approvalLedgerRoot), branchName, commitMessage });
  stdout.write(`${JSON.stringify(outcome, null, 2)}\n`); if (outcome.status !== "completed") process.exitCode = 1;
}
