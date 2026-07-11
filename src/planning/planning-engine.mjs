const taskTemplates = {
  repository_analysis: [
    ["inspect", "Identify repository scope", "Identify explicit repository targets from the request."],
    ["analyze", "Analyze requested repository concern", "Analyze only the interpreted request context."],
    ["validate", "Define evidence validation", "Define evidence needed before conclusions."],
    ["report", "Prepare analysis report", "Prepare a report plan without performing repository analysis."]
  ],
  schema_creation: [
    ["inspect", "Inspect ownership boundary", "Confirm schema ownership before design."],
    ["design", "Design schema proposal", "Define DEV-AGENT-owned schema requirements."],
    ["create", "Propose schema artifact", "Propose schema creation without executing writes."],
    ["validate", "Define schema validation", "Define example and schema validation checks."],
    ["document", "Plan documentation update", "Identify documentation that may need alignment."],
    ["review", "Prepare review package", "Prepare policy and human review evidence."]
  ],
  documentation_update: [
    ["inspect", "Identify canonical document", "Identify explicit documentation targets."],
    ["design", "Propose documentation change", "Define minimal documentation update."],
    ["validate", "Plan consistency validation", "Define cross-reference checks."],
    ["review", "Prepare documentation review", "Prepare review summary."]
  ],
  bug_investigation: [
    ["inspect", "Gather reproduction evidence", "List evidence required to reproduce the issue."],
    ["analyze", "Isolate likely cause", "Analyze request-described symptoms only."],
    ["propose", "Propose correction path", "Plan correction without implementing it."],
    ["test", "Define regression tests", "Plan tests required before trust."]
  ],
  code_modification: [
    ["inspect", "Inspect target code", "Identify target code from explicit request context."],
    ["design", "Define minimal change", "Design proposed change without editing files."],
    ["test", "Define tests", "Define tests required for future implementation."],
    ["rollback_prepare", "Prepare rollback intent", "Plan rollback preparation before writes."]
  ],
  validation: [
    ["inspect", "Identify validation targets", "Identify explicit validation targets."],
    ["validate", "Plan validation checks", "Define validation checks without running them."],
    ["report", "Prepare validation report", "Plan validation reporting."]
  ],
  review: [
    ["inspect", "Identify review scope", "Identify explicit review targets."],
    ["review", "Plan engineering review", "Define review criteria."],
    ["report", "Prepare review report", "Plan review reporting."]
  ]
};

const modifyingActions = new Set(["create", "modify", "refactor"]);

function now() {
  return new Date(0).toISOString();
}

function planIdForRequest(request) {
  const base = String(request.requestId ?? "request_unknown").replace(/^request_/, "");
  return `plan_${base}`;
}

function statusForRequest(request) {
  if (request.status === "ready_for_planning") return "proposed";
  if (request.status === "needs_clarification") return "waiting_for_evidence";
  if (request.status === "unverified") return "unverified";
  if (request.status === "no_action") return "no_action";
  if (request.status === "blocked") return "blocked";
  if (request.status === "unsupported") return "blocked";
  return "draft";
}

function readinessForRequest(request, protectedActions) {
  if (request.status === "ready_for_planning") {
    if (protectedActions.length > 0 || request.approvalLikelyRequired) return "needs_approval";
    return "needs_policy";
  }
  if (request.status === "needs_clarification") return "needs_evidence";
  if (request.status === "unverified") return "unverified";
  if (request.status === "no_action") return "no_action";
  return "blocked";
}

function nextActionForReadiness(readiness) {
  if (readiness === "needs_policy") return "request_policy_evaluation";
  if (readiness === "needs_approval") return "request_human_approval";
  if (readiness === "needs_evidence") return "gather_more_evidence";
  if (readiness === "no_action") return "no_action";
  if (readiness === "unverified") return "gather_more_evidence";
  return "no_action";
}

function protectedActionsFromRequest(request) {
  const mapped = (request.preliminaryRiskIndicators ?? []).map((risk) => {
    if (["delete"].includes(risk.category)) return "destructive_action";
    if (["move", "rename", "overwrite"].includes(risk.category)) return "file_write";
    if (["commit", "push"].includes(risk.category)) return "git_write";
    if (risk.category === "deploy") return "deployment";
    if (risk.category === "credential_access") return "external_write";
    return risk.category;
  });
  return [...new Set(mapped)];
}

function templateForRequest(request) {
  if (request.status === "needs_clarification") {
    return [["review", "Clarify engineering request", "Ask for missing context before technical planning."]];
  }
  if (request.status === "unverified") {
    return [["validate", "Collect verification evidence", "Identify evidence required before planning."]];
  }
  if (request.status === "blocked" || request.status === "no_action" || request.status === "unsupported") {
    return [];
  }
  return taskTemplates[request.taskType] ?? [["review", "Clarify unknown task", "Clarify task type before planning."]];
}

function buildSteps(request) {
  return templateForRequest(request).map(([actionType, title, description], index) => ({
    stepId: `step_${String(index + 1).padStart(2, "0")}_${actionType}`,
    sequence: index + 1,
    title,
    description,
    actionType,
    targetRefs: [
      ...(request.targetRepositories ?? []),
      ...(request.targetFiles ?? []),
      ...(request.targetComponents ?? [])
    ],
    requiredInputs: ["validated engineering request"],
    expectedOutputs: [`planned ${actionType} output`],
    dependencies: index === 0 ? [] : [`step_${String(index).padStart(2, "0")}_${templateForRequest(request)[index - 1][0]}`],
    validationRequirements: ["Step remains a proposal and does not claim execution."],
    riskNotes: "No execution is authorized by this step.",
    approvalRequired: request.approvalLikelyRequired === true || modifyingActions.has(actionType),
    status: request.status === "ready_for_planning" ? "planned" : request.status === "needs_clarification" ? "waiting_for_input" : "blocked"
  }));
}

function scopeFromRequest(request) {
  return {
    targetRepositories: request.targetRepositories ?? [],
    affectedComponents: request.targetComponents ?? [],
    affectedFiles: request.targetFiles ?? [],
    excludedFiles: [],
    inScope: [
      `Plan ${request.taskType} from interpreted request.`,
      "Represent validation and review intent."
    ],
    outOfScope: [
      "Repository file inspection",
      "Policy authorization",
      "Implementation",
      "Git operations",
      "Deployment"
    ]
  };
}

function repositoryContextFromOptions(options) {
  const engineeringContext = options.engineeringContext;
  if (engineeringContext && typeof engineeringContext === "object") {
    return {
      contextRef: engineeringContext.contextId,
      refs: engineeringContext.repositoryIntelligenceRef ? [engineeringContext.repositoryIntelligenceRef] : [],
      summary: `Engineering Context selected ${(engineeringContext.relevantFiles ?? []).length} relevant repository artifacts.`,
      relevantFiles: (engineeringContext.relevantFiles ?? []).map((item) => item.path),
      assumptions: [
        {
          statement: "Planning context was supplied by the DEV-AGENT Context Builder.",
          verificationStatus: "verified"
        },
        {
          statement: "Engineering Context is selected repository evidence, not execution authority.",
          verificationStatus: "verified"
        }
      ],
      limitations: [
        "Planning consumed only the artifacts selected in Engineering Context.",
        ...(engineeringContext.missingContext ?? []).map((item) => `Engineering Context missing: ${item}`),
        "Engineering Context does not authorize implementation or replace KAVEEP-RO assessment."
      ]
    };
  }

  const repositoryIntelligence = options.repositoryIntelligence;
  if (!repositoryIntelligence || typeof repositoryIntelligence !== "object") {
    return {
      contextRef: undefined,
      refs: [],
      summary: undefined,
      relevantFiles: [],
      assumptions: [],
      limitations: [
        "Repository Intelligence has not been invoked.",
        "No files have been inspected by the Planning Engine."
      ]
    };
  }

  return {
    contextRef: undefined,
    refs: repositoryIntelligence.intelligenceId ? [repositoryIntelligence.intelligenceId] : [],
    summary: repositoryIntelligence.summary,
    relevantFiles: repositoryIntelligence.relevantFiles ?? [],
    assumptions: [
      {
        statement: "Repository context was supplied by DEV-AGENT Repository Intelligence.",
        verificationStatus: "verified"
      },
      {
        statement: "Repository Intelligence observations are task context, not repository compliance conclusions.",
        verificationStatus: "verified"
      }
    ],
    limitations: [
      "Repository Intelligence context was consumed as bounded observations only.",
      "Repository Intelligence does not authorize implementation or replace KAVEEP-RO assessment."
    ]
  };
}

function pruneUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(pruneUndefined);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, pruneUndefined(entryValue)])
    );
  }
  return value;
}

export function createEngineeringPlan(request, options = {}) {
  if (!request || typeof request !== "object") {
    throw new Error("Engineering Request object is required.");
  }

  const protectedActions = protectedActionsFromRequest(request);
  const executionReadiness = readinessForRequest(request, protectedActions);
  const status = statusForRequest(request);
  const steps = buildSteps(request);
  const requiresRollback = (request.requestedActions ?? []).some((action) => modifyingActions.has(action));
  const repositoryContext = repositoryContextFromOptions(options);

  return pruneUndefined({
    planId: options.planId ?? planIdForRequest(request),
    schemaVersion: "1.0.0",
    planVersion: "1.0.0",
    title: `Engineering Plan for ${request.taskType}`,
    objective: request.interpretedIntent || request.requestSummary,
    status,
    requestId: request.requestId,
    missionId: options.missionId,
    workflowId: options.workflowId,
    taskId: options.taskId,
    sessionRef: options.sessionRef,
    repositoryRefs: (request.targetRepositories ?? []).map((repository) => ({
      repository,
      owner: repository === "current_repository" ? "KAVEEP-DEV-AGENT" : repository,
      role: "target"
    })),
    repositoryIntelligenceRefs: repositoryContext.refs.length > 0 ? repositoryContext.refs : undefined,
    engineeringContextRef: repositoryContext.contextRef,
    repositoryContextSummary: repositoryContext.summary,
    relevantFileRefs: repositoryContext.relevantFiles.length > 0 ? repositoryContext.relevantFiles : undefined,
    requestSummary: request.requestSummary,
    engineeringObjective: request.interpretedIntent,
    interpretedIntent: request.interpretedIntent,
    assumptions: [
      {
        statement: "Planning is derived only from the structured Engineering Request.",
        verificationStatus: "verified"
      },
      ...(request.assumptions ?? []).map((assumption) => ({
        statement: assumption.statement,
        verificationStatus: assumption.verificationStatus
      })),
      ...repositoryContext.assumptions
    ],
    constraints: [
      ...(request.constraints ?? []),
      "A valid plan does not authorize implementation.",
      "POLICY evaluation remains external."
    ],
    acceptanceCriteria: request.acceptanceCriteria ?? [],
    limitations: [
      ...(request.missingContext ?? []).map((item) => `Missing context: ${item}`),
      ...repositoryContext.limitations
    ],
    scope: scopeFromRequest(request),
    steps,
    validationIntent: {
      testPlan: ["Define tests appropriate to the requested engineering work."],
      validationPlan: ["Validate generated plan against engineering-plan.schema.json."],
      lintPlan: ["Run available static consistency checks before future implementation."],
      buildPlan: ["No build is performed by the Planning Engine."],
      reviewPlan: ["Perform engineering review before protected actions."],
      rollbackPlan: requiresRollback
        ? "Prepare rollback before future file changes. Rollback execution requires future runtime and approval."
        : "No rollback execution is planned by this read-only Planning Engine."
    },
    safety: {
      riskLevel: protectedActions.length > 0 ? "high" : request.status === "unverified" ? "unverified" : "moderate",
      sandboxRequired: protectedActions.length > 0 || requiresRollback,
      sandboxRequirements: [
        "No execution by Planning Engine.",
        "Human approval before protected actions.",
        "Policy evaluation before sandbox use."
      ],
      protectedActions,
      planAuthorizesExecution: false
    },
    executionReadiness,
    blockingReasons: [
      ...(request.detectedAmbiguities ?? []).map((item) => `Ambiguity: ${item}`),
      ...(request.missingContext ?? []).map((item) => `Missing context: ${item}`),
      ...(protectedActions.length > 0 ? ["Protected actions require policy evaluation and human approval."] : [])
    ],
    recommendedNextAction: nextActionForReadiness(executionReadiness),
    createdAt: options.createdAt ?? now(),
    updatedAt: options.updatedAt ?? now()
  });
}
