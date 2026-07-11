const thaiPattern = /[\u0E00-\u0E7F]/;

const taskRules = [
  ["repository_analysis", [/repository/i, /repo/i, /คลัง/i, /ตรวจ/i, /วิเคราะห์/i]],
  ["schema_creation", [/schema/i, /สคีมา/i, /สร้าง.*schema/i, /เพิ่ม.*schema/i]],
  ["architecture_design", [/architecture/i, /สถาปัต/i]],
  ["specification_creation", [/spec/i, /ข้อกำหนด/i]],
  ["documentation_update", [/doc/i, /document/i, /เอกสาร/i]],
  ["code_modification", [/แก้โค้ด/i, /modify code/i, /code change/i]],
  ["code_creation", [/เขียนโค้ด/i, /create code/i]],
  ["refactoring", [/refactor/i, /ปรับโครง/i]],
  ["bug_investigation", [/bug/i, /บั๊ก/i, /ปัญหา/i]],
  ["test_creation", [/test/i, /ทดสอบ/i]],
  ["validation", [/validate/i, /validation/i, /ตรวจสอบ/i]],
  ["review", [/review/i, /รีวิว/i]],
  ["report_generation", [/report/i, /รายงาน/i]],
  ["repository_creation", [/create repository/i, /สร้าง repo/i]],
  ["agent_creation", [/agent/i, /เอเจนต์/i]]
];

const actionRules = [
  ["inspect", [/ตรวจ/i, /inspect/i]],
  ["analyze", [/วิเคราะห์/i, /analy[sz]e/i]],
  ["design", [/ออกแบบ/i, /design/i]],
  ["plan", [/แผน/i, /plan/i]],
  ["propose", [/เสนอ/i, /propose/i]],
  ["create", [/สร้าง/i, /เพิ่ม/i, /create/i, /add/i]],
  ["modify", [/แก้/i, /modify/i, /change/i]],
  ["refactor", [/refactor/i]],
  ["validate", [/validate/i, /ตรวจสอบ/i]],
  ["test", [/test/i, /ทดสอบ/i]],
  ["document", [/document/i, /เอกสาร/i]],
  ["review", [/review/i, /รีวิว/i]],
  ["report", [/report/i, /รายงาน/i]]
];

const protectedRules = [
  ["delete", [/delete/i, /ลบ/i]],
  ["move", [/move/i, /ย้าย/i]],
  ["rename", [/rename/i, /เปลี่ยนชื่อ/i]],
  ["overwrite", [/overwrite/i, /เขียนทับ/i]],
  ["external_write", [/external write/i, /เขียนภายนอก/i]],
  ["commit", [/commit/i]],
  ["push", [/push/i]],
  ["merge", [/merge/i]],
  ["release", [/release/i]],
  ["deploy", [/deploy/i, /ปรับใช้/i]],
  ["publish", [/publish/i, /เผยแพร่/i]],
  ["operating_system_change", [/operating system/i, /ระบบปฏิบัติการ/i]],
  ["credential_access", [/credential/i, /secret/i, /token/i, /รหัสผ่าน/i]]
];

function normalizeCommand(command) {
  return String(command ?? "").replace(/\s+/g, " ").trim();
}

function detectLanguage(command) {
  const hasThai = thaiPattern.test(command);
  const hasLatin = /[A-Za-z]/.test(command);
  if (hasThai && hasLatin) return "mixed";
  if (hasThai) return "thai";
  if (hasLatin) return "english";
  return "unknown";
}

function matchRules(command, rules) {
  return rules
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(command)))
    .map(([value]) => value);
}

function chooseTaskType(command) {
  const matches = matchRules(command, taskRules);
  if (matches.includes("schema_creation")) return "schema_creation";
  if (matches.includes("repository_analysis")) return "repository_analysis";
  return matches[0] ?? "unknown";
}

function unique(values) {
  return [...new Set(values)];
}

function extractRepositories(command) {
  const repos = [];
  for (const match of command.matchAll(/\bKAVEEP-[A-Z0-9-]+\b/g)) {
    repos.push(match[0]);
  }
  if (/\b(repo|repository)\b/i.test(command) || /Repository/i.test(command) || /คลัง/.test(command)) {
    repos.push("current_repository");
  }
  return unique(repos);
}

function extractFiles(command) {
  const matches = command.match(/\b[\w./-]+\.(?:md|json|js|mjs|ts|tsx|py|yaml|yml)\b/gi) ?? [];
  return unique(matches);
}

function extractComponents(command) {
  const components = [];
  if (/schema/i.test(command)) components.push("schemas");
  if (/architecture/i.test(command) || /สถาปัต/.test(command)) components.push("architecture");
  if (/doc|เอกสาร/i.test(command)) components.push("documentation");
  if (/test|ทดสอบ/i.test(command)) components.push("tests");
  return unique(components);
}

function buildRiskIndicators(command) {
  return matchRules(command, protectedRules).map((category) => ({
    indicator: `Detected protected-action language: ${category}`,
    category,
    severity: ["delete", "merge", "release", "deploy", "credential_access"].includes(category) ? "high" : "moderate"
  }));
}

function inferStatus({ command, taskType, actions, riskIndicators }) {
  if (!command) return "no_action";
  if (riskIndicators.length > 0) return "blocked";
  if (taskType === "unknown" || actions.length === 0) return "needs_clarification";
  return "ready_for_planning";
}

function readinessForStatus(status) {
  if (status === "ready_for_planning") return "ready";
  if (status === "blocked") return "blocked";
  if (status === "no_action") return "blocked";
  if (status === "unsupported") return "unsupported";
  if (status === "unverified") return "unverified";
  return "needs_clarification";
}

function nextActionForStatus(status) {
  if (status === "ready_for_planning") return "send_to_planning";
  if (status === "blocked") return "block_protected_action";
  if (status === "no_action") return "no_action";
  if (status === "unsupported") return "reject_unsupported";
  return "ask_clarifying_question";
}

export function interpretEngineeringCommand(command, options = {}) {
  const originalCommand = String(command ?? "");
  const normalizedCommand = normalizeCommand(originalCommand);
  const language = detectLanguage(normalizedCommand);
  const taskType = chooseTaskType(normalizedCommand);
  const requestedActions = unique(matchRules(normalizedCommand, actionRules));
  const preliminaryRiskIndicators = buildRiskIndicators(normalizedCommand);
  const status = inferStatus({
    command: normalizedCommand,
    taskType,
    actions: requestedActions,
    riskIndicators: preliminaryRiskIndicators
  });
  const detectedAmbiguities = [];
  const missingContext = [];

  if (!normalizedCommand) {
    detectedAmbiguities.push("Command is empty.");
    missingContext.push("engineering intent");
  }
  if (taskType === "unknown" && normalizedCommand) {
    detectedAmbiguities.push("Engineering task type could not be determined confidently.");
  }
  if (extractRepositories(normalizedCommand).length === 0 && normalizedCommand) {
    missingContext.push("target repository");
  }

  const approvalLikelyRequired = preliminaryRiskIndicators.length > 0 || /อนุมัติ|approval/i.test(normalizedCommand);

  return {
    requestId: options.requestId ?? "request_interpreted_command_001",
    schemaVersion: "1.0.0",
    language,
    originalCommand,
    normalizedCommand,
    requestSummary: normalizedCommand ? `Interpreted engineering request: ${normalizedCommand}` : "Empty engineering command.",
    interpretedIntent: taskType === "unknown" ? "Intent requires clarification." : `Prepare ${taskType} request for planning.`,
    taskType,
    targetRepositories: extractRepositories(normalizedCommand),
    targetFiles: extractFiles(normalizedCommand),
    targetComponents: extractComponents(normalizedCommand),
    requestedActions,
    constraints: approvalLikelyRequired
      ? ["Protected actions require policy evaluation and human approval."]
      : ["Interpretation does not authorize execution."],
    acceptanceCriteria: ["Structured request validates against engineering-request.schema.json."],
    assumptions: [
      {
        statement: "Interpreter output is a structured request, not execution authorization.",
        verificationStatus: "verified"
      }
    ],
    detectedAmbiguities,
    missingContext,
    preliminaryRiskIndicators,
    requestedAutonomyLevel: "interpret_only",
    approvalLikelyRequired,
    planningReadiness: readinessForStatus(status),
    status,
    recommendedNextAction: nextActionForStatus(status),
    createdAt: options.createdAt ?? new Date(0).toISOString()
  };
}
