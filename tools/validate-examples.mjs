import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const invalidEngineeringPlanMode = process.argv.includes("--invalid-engineering-plan");
const invalidEngineeringRequestMode = process.argv.includes("--invalid-engineering-request");
const invalidRepositoryIntelligenceMode = process.argv.includes("--invalid-repository-intelligence");
const invalidEngineeringContextMode = process.argv.includes("--invalid-engineering-context");
const invalidToolRequestMode = process.argv.includes("--invalid-tool-request");
const invalidToolResultMode = process.argv.includes("--invalid-tool-result");
const invalidGateResultMode = process.argv.includes("--invalid-gate-result");
const invalidSandboxRequestMode = process.argv.includes("--invalid-sandbox-request");
const invalidSandboxManifestMode = process.argv.includes("--invalid-sandbox-manifest");
const invalidSandboxResultMode = process.argv.includes("--invalid-sandbox-result");
const invalidSandboxChangeMode = process.argv.includes("--invalid-sandbox-change");
const invalidSandboxDiffMode = process.argv.includes("--invalid-sandbox-diff");
const invalidSandboxEditResultMode = process.argv.includes("--invalid-sandbox-edit-result");
const invalidAuthoritySnapshotMode = process.argv.includes("--invalid-authority-snapshot");
const invalidMissionLockMode = process.argv.includes("--invalid-mission-lock");
const invalidGovernanceDriftResultMode = process.argv.includes("--invalid-governance-drift-result");
const invalidDevOrchestrationCheckpointMode = process.argv.includes("--invalid-dev-orchestration-checkpoint");
const invalidDevOrchestrationRunMode = process.argv.includes("--invalid-dev-orchestration-run");
const invalidDurableRunRecordMode = process.argv.includes("--invalid-durable-run-record");
const invalidDurableAuditEventMode = process.argv.includes("--invalid-durable-audit-event");
const invalidDurableReplayResultMode = process.argv.includes("--invalid-durable-replay-result");
const invalidDurableRecoveryResultMode = process.argv.includes("--invalid-durable-recovery-result");
const invalidStaticValidationRequestMode = process.argv.includes("--invalid-static-validation-request");
const invalidStaticValidationResultMode = process.argv.includes("--invalid-static-validation-result");
const invalidEngineeringProposalMode = process.argv.includes("--invalid-engineering-proposal");
const invalidEngineeringBrainRequestMode = process.argv.includes("--invalid-engineering-brain-request");
const invalidEngineeringBrainResultMode = process.argv.includes("--invalid-engineering-brain-result");
const invalidEngineeringLoopRequestMode = process.argv.includes("--invalid-engineering-loop-request");
const invalidEngineeringLoopResultMode = process.argv.includes("--invalid-engineering-loop-result");
const invalidReviewedChangeRequestMode = process.argv.includes("--invalid-reviewed-change-request");
const invalidReviewedChangeArtifactMode = process.argv.includes("--invalid-reviewed-change-artifact");
const invalidChangeReviewAttestationMode = process.argv.includes("--invalid-change-review-attestation");
const invalidChangeApprovalVerificationMode = process.argv.includes("--invalid-change-approval-verification");
const invalidControlledWriteRequestMode = process.argv.includes("--invalid-controlled-write-request");
const invalidControlledWriteResultMode = process.argv.includes("--invalid-controlled-write-result");
const invalidWriteTransactionJournalMode = process.argv.includes("--invalid-write-transaction-journal");
const invalidWriteRecoveryResultMode = process.argv.includes("--invalid-write-recovery-result");
const invalidContainerValidationRequestMode = process.argv.includes("--invalid-container-validation-request");
const invalidContainerValidationResultMode = process.argv.includes("--invalid-container-validation-result");
const invalidStandaloneSessionRequestMode = process.argv.includes("--invalid-standalone-session-request");
const invalidStandaloneSessionResultMode = process.argv.includes("--invalid-standalone-session-result");
const failureTestMode = process.argv.includes("--failure-test");

const baseValidationTargets = [
  {
    schema: path.join(repoRoot, "schemas", "engineering-request.schema.json"),
    example: path.join(repoRoot, "examples", "engineering-request.example.json")
  },
  {
    schema: path.join(repoRoot, "schemas", "engineering-plan.schema.json"),
    example: path.join(repoRoot, "examples", "engineering-plan.example.json")
  },
  {
    schema: path.join(repoRoot, "schemas", "repository-intelligence.schema.json"),
    example: path.join(repoRoot, "examples", "repository-intelligence.example.json")
  },
  {
    schema: path.join(repoRoot, "schemas", "engineering-context.schema.json"),
    example: path.join(repoRoot, "examples", "engineering-context.example.json")
  },
  { schema: path.join(repoRoot, "schemas", "tool-descriptor.schema.json"), example: path.join(repoRoot, "examples", "tool-descriptor.example.json") },
  { schema: path.join(repoRoot, "schemas", "tool-request.schema.json"), example: path.join(repoRoot, "examples", "tool-request.example.json") },
  { schema: path.join(repoRoot, "schemas", "tool-result.schema.json"), example: path.join(repoRoot, "examples", "tool-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "execution-gate-result.schema.json"), example: path.join(repoRoot, "examples", "execution-gate-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "sandbox-request.schema.json"), example: path.join(repoRoot, "examples", "sandbox-request.example.json") },
  { schema: path.join(repoRoot, "schemas", "sandbox-manifest.schema.json"), example: path.join(repoRoot, "examples", "sandbox-manifest.example.json") },
  { schema: path.join(repoRoot, "schemas", "sandbox-result.schema.json"), example: path.join(repoRoot, "examples", "sandbox-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "sandbox-change.schema.json"), example: path.join(repoRoot, "examples", "sandbox-change.example.json") },
  { schema: path.join(repoRoot, "schemas", "sandbox-diff.schema.json"), example: path.join(repoRoot, "examples", "sandbox-diff.example.json") },
  { schema: path.join(repoRoot, "schemas", "sandbox-edit-result.schema.json"), example: path.join(repoRoot, "examples", "sandbox-edit-result.example.json") },
  {
    schema: path.join(repoRoot, "schemas", "dev-agent-report.schema.json"),
    example: path.join(repoRoot, "examples", "dev-agent-report.example.json")
  },
  { schema: path.join(repoRoot, "schemas", "authority-snapshot.schema.json"), example: path.join(repoRoot, "examples", "authority-snapshot.example.json") },
  { schema: path.join(repoRoot, "schemas", "mission-lock.schema.json"), example: path.join(repoRoot, "examples", "mission-lock.example.json") },
  { schema: path.join(repoRoot, "schemas", "governance-drift-result.schema.json"), example: path.join(repoRoot, "examples", "governance-drift-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "dev-orchestration-checkpoint.schema.json"), example: path.join(repoRoot, "examples", "dev-orchestration-checkpoint.example.json") },
  { schema: path.join(repoRoot, "schemas", "dev-orchestration-run.schema.json"), example: path.join(repoRoot, "examples", "dev-orchestration-run.example.json") },
  { schema: path.join(repoRoot, "schemas", "durable-run-record.schema.json"), example: path.join(repoRoot, "examples", "durable-run-record.example.json") },
  { schema: path.join(repoRoot, "schemas", "durable-audit-event.schema.json"), example: path.join(repoRoot, "examples", "durable-audit-event.example.json") },
  { schema: path.join(repoRoot, "schemas", "durable-replay-result.schema.json"), example: path.join(repoRoot, "examples", "durable-replay-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "durable-recovery-result.schema.json"), example: path.join(repoRoot, "examples", "durable-recovery-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "static-validation-request.schema.json"), example: path.join(repoRoot, "examples", "static-validation-request.example.json") },
  { schema: path.join(repoRoot, "schemas", "static-validation-result.schema.json"), example: path.join(repoRoot, "examples", "static-validation-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "engineering-proposal.schema.json"), example: path.join(repoRoot, "examples", "engineering-proposal.example.json") },
  { schema: path.join(repoRoot, "schemas", "engineering-brain-request.schema.json"), example: path.join(repoRoot, "examples", "engineering-brain-request.example.json") },
  { schema: path.join(repoRoot, "schemas", "engineering-brain-result.schema.json"), example: path.join(repoRoot, "examples", "engineering-brain-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "engineering-loop-request.schema.json"), example: path.join(repoRoot, "examples", "engineering-loop-request.example.json") },
  { schema: path.join(repoRoot, "schemas", "engineering-loop-result.schema.json"), example: path.join(repoRoot, "examples", "engineering-loop-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "reviewed-change-request.schema.json"), example: path.join(repoRoot, "examples", "reviewed-change-request.example.json") },
  { schema: path.join(repoRoot, "schemas", "reviewed-change-artifact.schema.json"), example: path.join(repoRoot, "examples", "reviewed-change-artifact.example.json") },
  { schema: path.join(repoRoot, "schemas", "change-review-attestation.schema.json"), example: path.join(repoRoot, "examples", "change-review-attestation.example.json") },
  { schema: path.join(repoRoot, "schemas", "change-approval-verification-result.schema.json"), example: path.join(repoRoot, "examples", "change-approval-verification-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "controlled-write-request.schema.json"), example: path.join(repoRoot, "examples", "controlled-write-request.example.json") },
  { schema: path.join(repoRoot, "schemas", "controlled-write-result.schema.json"), example: path.join(repoRoot, "examples", "controlled-write-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "write-transaction-journal.schema.json"), example: path.join(repoRoot, "examples", "write-transaction-journal.example.json") },
  { schema: path.join(repoRoot, "schemas", "write-recovery-result.schema.json"), example: path.join(repoRoot, "examples", "write-recovery-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "container-validation-request.schema.json"), example: path.join(repoRoot, "examples", "container-validation-request.example.json") },
  { schema: path.join(repoRoot, "schemas", "container-validation-result.schema.json"), example: path.join(repoRoot, "examples", "container-validation-result.example.json") },
  { schema: path.join(repoRoot, "schemas", "standalone-session-request.schema.json"), example: path.join(repoRoot, "examples", "standalone-session-request.example.json") },
  { schema: path.join(repoRoot, "schemas", "standalone-session-result.schema.json"), example: path.join(repoRoot, "examples", "standalone-session-result.example.json") }
];

const validationTargets = invalidEngineeringRequestMode
  ? [baseValidationTargets[0]]
  : invalidEngineeringPlanMode || failureTestMode
  ? [baseValidationTargets[1]]
  : invalidRepositoryIntelligenceMode
  ? [baseValidationTargets[2]]
  : invalidEngineeringContextMode
  ? [baseValidationTargets[3]]
  : invalidToolRequestMode
  ? [baseValidationTargets[5]]
  : invalidToolResultMode
  ? [baseValidationTargets[6]]
  : invalidGateResultMode
  ? [baseValidationTargets[7]]
  : invalidSandboxRequestMode
  ? [baseValidationTargets[8]]
  : invalidSandboxManifestMode
  ? [baseValidationTargets[9]]
  : invalidSandboxResultMode
  ? [baseValidationTargets[10]]
  : invalidSandboxChangeMode ? [baseValidationTargets[11]]
  : invalidSandboxDiffMode ? [baseValidationTargets[12]]
  : invalidSandboxEditResultMode ? [baseValidationTargets[13]]
  : invalidAuthoritySnapshotMode ? [baseValidationTargets[15]]
  : invalidMissionLockMode ? [baseValidationTargets[16]]
  : invalidGovernanceDriftResultMode ? [baseValidationTargets[17]]
  : invalidDevOrchestrationCheckpointMode ? [baseValidationTargets[18]]
  : invalidDevOrchestrationRunMode ? [baseValidationTargets[19]]
  : invalidDurableRunRecordMode ? [baseValidationTargets[20]]
  : invalidDurableAuditEventMode ? [baseValidationTargets[21]]
  : invalidDurableReplayResultMode ? [baseValidationTargets[22]]
  : invalidDurableRecoveryResultMode ? [baseValidationTargets[23]]
  : invalidStaticValidationRequestMode ? [baseValidationTargets[24]]
  : invalidStaticValidationResultMode ? [baseValidationTargets[25]]
  : invalidEngineeringProposalMode ? [baseValidationTargets[26]]
  : invalidEngineeringBrainRequestMode ? [baseValidationTargets[27]]
  : invalidEngineeringBrainResultMode ? [baseValidationTargets[28]]
  : invalidEngineeringLoopRequestMode ? [baseValidationTargets[29]]
  : invalidEngineeringLoopResultMode ? [baseValidationTargets[30]]
  : invalidReviewedChangeRequestMode ? [baseValidationTargets[31]]
  : invalidReviewedChangeArtifactMode ? [baseValidationTargets[32]]
  : invalidChangeReviewAttestationMode ? [baseValidationTargets[33]]
  : invalidChangeApprovalVerificationMode ? [baseValidationTargets[34]]
  : invalidControlledWriteRequestMode ? [baseValidationTargets[35]]
  : invalidControlledWriteResultMode ? [baseValidationTargets[36]]
  : invalidWriteTransactionJournalMode ? [baseValidationTargets[37]]
  : invalidWriteRecoveryResultMode ? [baseValidationTargets[38]]
  : invalidContainerValidationRequestMode ? [baseValidationTargets[39]]
  : invalidContainerValidationResultMode ? [baseValidationTargets[40]]
  : invalidStandaloneSessionRequestMode ? [baseValidationTargets[41]]
  : invalidStandaloneSessionResultMode ? [baseValidationTargets[42]]
  : baseValidationTargets;

const schemaCache = new Map();
const resolvedExternalRefs = new Set();
const resolvedExampleSchemaRefs = new Set();
const auditedSchemaRefs = new Set();

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function makeInvalidEngineeringPlan(example) {
  return {
    ...example,
    safety: {
      ...example.safety,
      planAuthorizesExecution: true
    }
  };
}

function makeInvalidEngineeringRequest(example) {
  return {
    ...example,
    status: "executed"
  };
}

function makeInvalidRepositoryIntelligence(example) {
  return {
    ...example,
    status: "executed"
  };
}

function makeInvalidEngineeringContext(example) {
  return {
    ...example,
    status: "executed"
  };
}

function makeInvalidToolRequest(example) { return { ...example, status: "executed" }; }
function makeInvalidToolResult(example) { return { ...example, status: "executed" }; }
function makeInvalidGateResult(example) { return { ...example, decision: "approved" }; }
function makeInvalidSandboxRequest(example) { return { ...example, status:"approved" }; }
function makeInvalidSandboxManifest(example) { return { ...example, status:"deployed" }; }
function makeInvalidSandboxResult(example) { return { ...example, status:"merged" }; }
function makeInvalidSandboxChange(example) { return { ...example, sourceRepositoryModified:true }; }
function makeInvalidSandboxDiff(example) { return { ...example, bytesChanged:-1 }; }
function makeInvalidSandboxEditResult(example) { return { ...example, sourceRepositoryModified:true }; }
function makeInvalidAuthoritySnapshot(example) { return { ...example, status:"authorized" }; }
function makeInvalidMissionLock(example) { return { ...example, status:"self_modified" }; }
function makeInvalidGovernanceDriftResult(example) { return { ...example, decision:"authorize_execution" }; }
function makeInvalidDevOrchestrationCheckpoint(example) { return { ...example, durablyPersisted:true, resumable:true }; }
function makeInvalidDevOrchestrationRun(example) { return { ...example, status:"executing" }; }
function makeInvalidDurableRunRecord(example) { return { ...example, status:"executing" }; }
function makeInvalidDurableAuditEvent(example) { return { ...example, eventType:"event_deleted" }; }
function makeInvalidDurableReplayResult(example) { return { ...example, status:"trusted_without_verification" }; }
function makeInvalidDurableRecoveryResult(example) { return { ...example, governanceRecheckRequired:false }; }
function makeInvalidStaticValidationRequest(example) { return { ...example, operation:"shell_execute" }; }
function makeInvalidStaticValidationResult(example) { return { ...example, sourceRepositoryModified:true }; }
function makeInvalidEngineeringProposal(example) { return { ...example, proposalAuthorizesExecution:true }; }
function makeInvalidEngineeringBrainRequest(example) { return { ...example, status:"executing" }; }
function makeInvalidEngineeringBrainResult(example) { return { ...example, status:"executed" }; }
function makeInvalidEngineeringLoopRequest(example) { return { ...example, maxAttempts:100 }; }
function makeInvalidEngineeringLoopResult(example) { return { ...example, sourceRepositoryModified:true }; }
function makeInvalidReviewedChangeRequest(example) { return { ...example, status:"approved" }; }
function makeInvalidReviewedChangeArtifact(example) { return { ...example, artifactAuthorizesSourceWrite:true }; }
function makeInvalidChangeReviewAttestation(example) { return { ...example, oneTimeUse:false }; }
function makeInvalidChangeApprovalVerification(example) { return { ...example, decision:"authorized_to_write" }; }
function makeInvalidControlledWriteRequest(example) { return { ...example, status:"auto_execute" }; }
function makeInvalidControlledWriteResult(example) { return { ...example, gitOperationPerformed:true }; }
function makeInvalidWriteTransactionJournal(example) { return { ...example, state:"auto_committed" }; }
function makeInvalidWriteRecoveryResult(example) { return { ...example, gitOperationPerformed:true }; }
function makeInvalidContainerValidationRequest(example) { return { ...example, operations:["shell"] }; }
function makeInvalidContainerValidationResult(example) { return { ...example, sourceRepositoryModified:true }; }
function makeInvalidStandaloneSessionRequest(example) { return { ...example, status:"auto_execute" }; }
function makeInvalidStandaloneSessionResult(example) { return { ...example, status:"source_written" }; }

export async function loadSchema(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!schemaCache.has(absolutePath)) {
    schemaCache.set(absolutePath, await readJson(absolutePath));
  }
  return schemaCache.get(absolutePath);
}

function decodePointerPart(part) {
  return part.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveJsonPointer(document, pointer) {
  if (!pointer || pointer === "#") {
    return document;
  }

  if (!pointer.startsWith("#/")) {
    throw new Error(`Unsupported JSON pointer: ${pointer}`);
  }

  return pointer
    .slice(2)
    .split("/")
    .map(decodePointerPart)
    .reduce((current, key) => {
      if (current && Object.prototype.hasOwnProperty.call(current, key)) {
        return current[key];
      }
      throw new Error(`Unresolved JSON pointer segment: ${key}`);
    }, document);
}

async function resolveRef(ref, schemaPath, rootSchema) {
  const [refPath, fragment = ""] = ref.split("#");

  if (!refPath) {
    return {
      schema: resolveJsonPointer(rootSchema, `#${fragment}`),
      schemaPath,
      rootSchema
    };
  }

  const targetPath = path.resolve(path.dirname(schemaPath), refPath);
  const targetSchema = await loadSchema(targetPath);
  resolvedExternalRefs.add(targetPath);

  return {
    schema: fragment ? resolveJsonPointer(targetSchema, `#${fragment}`) : targetSchema,
    schemaPath: targetPath,
    rootSchema: targetSchema
  };
}

function typeOf(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function isValidDateTime(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function pushError(errors, location, message) {
  errors.push(`${location}: ${message}`);
}

function collectSchemaRefs(value, refs = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSchemaRefs(item, refs);
    }
    return refs;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "schemaRef" && typeof child === "string") {
        refs.push(child);
      } else {
        collectSchemaRefs(child, refs);
      }
    }
  }

  return refs;
}

function collectJsonSchemaRefs(value, refs = [], location = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectJsonSchemaRefs(item, refs, `${location}[${index}]`));
    return refs;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const childLocation = `${location}.${key}`;
      if (key === "$ref" && typeof child === "string") {
        refs.push({ ref: child, location: childLocation });
      } else {
        collectJsonSchemaRefs(child, refs, childLocation);
      }
    }
  }

  return refs;
}

function splitRefPath(ref) {
  const [refPath, fragment = ""] = ref.split("#");
  return { refPath, fragment };
}

function isRemoteRef(refPath) {
  return /^[a-z][a-z0-9+.-]*:/i.test(refPath);
}

function hasExternalSchemaRef(schema) {
  return collectJsonSchemaRefs(schema).some(({ ref }) => {
    const { refPath } = splitRefPath(ref);
    return Boolean(refPath);
  });
}

async function validateExampleSchemaRefs(example, examplePath, errors) {
  const refs = collectSchemaRefs(example);

  for (const ref of refs) {
    const refPath = path.resolve(path.dirname(examplePath), ref);
    try {
      await access(refPath);
      resolvedExampleSchemaRefs.add(refPath);
    } catch {
      pushError(errors, "$", `schemaRef does not resolve: ${ref}`);
    }
  }
}

async function auditSchemaReferenceGraph(schemaPath, errors, warnings, rootKind) {
  const absoluteSchemaPath = path.resolve(schemaPath);
  if (auditedSchemaRefs.has(absoluteSchemaPath)) {
    return;
  }
  auditedSchemaRefs.add(absoluteSchemaPath);

  let schema;
  try {
    schema = await loadSchema(absoluteSchemaPath);
  } catch (error) {
    const message = `${path.relative(repoRoot, absoluteSchemaPath)}: schema could not be read as JSON (${error.message})`;
    if (rootKind === "dev-agent") {
      pushError(errors, "$", message);
    } else {
      warnings.push(message);
    }
    return;
  }

  for (const { ref, location } of collectJsonSchemaRefs(schema)) {
    const { refPath, fragment } = splitRefPath(ref);

    if (isRemoteRef(refPath)) {
      warnings.push(`${path.relative(repoRoot, absoluteSchemaPath)} ${location}: remote $ref not resolved by local validator: ${ref}`);
      continue;
    }

    if (!refPath) {
      try {
        resolveJsonPointer(schema, `#${fragment}`);
      } catch (error) {
        const message = `${path.relative(repoRoot, absoluteSchemaPath)} ${location}: unresolved local $ref ${ref} (${error.message})`;
        if (rootKind === "dev-agent") {
          pushError(errors, "$", message);
        } else {
          warnings.push(message);
        }
      }
      continue;
    }

    const targetPath = path.resolve(path.dirname(absoluteSchemaPath), refPath);
    try {
      const targetSchema = await loadSchema(targetPath);
      if (fragment) {
        resolveJsonPointer(targetSchema, `#${fragment}`);
      }
      if (targetPath.startsWith(repoRoot)) {
        await auditSchemaReferenceGraph(targetPath, errors, warnings, "dev-agent");
      } else {
        await auditSchemaReferenceGraph(targetPath, errors, warnings, "external");
      }
    } catch (error) {
      const message = `${path.relative(repoRoot, absoluteSchemaPath)} ${location}: unresolved external $ref ${ref} (${error.message})`;
      if (rootKind === "dev-agent") {
        pushError(errors, "$", message);
      } else {
        warnings.push(message);
      }
    }
  }
}

export async function validateValue(value, schema, context, location, errors) {
  if (schema.$ref) {
    const resolved = await resolveRef(schema.$ref, context.schemaPath, context.rootSchema);
    await validateValue(value, resolved.schema, resolved, location, errors);
    return;
  }

  if (schema.allOf) {
    for (const child of schema.allOf) {
      await validateValue(value, child, context, location, errors);
    }
  }

  if (schema.const !== undefined && value !== schema.const) {
    pushError(errors, location, `expected const ${JSON.stringify(schema.const)}`);
  }

  if (schema.type) {
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = typeOf(value);
    const typeMatches = allowedTypes.includes(actualType) || (actualType === "integer" && allowedTypes.includes("number"));
    if (!typeMatches) {
      pushError(errors, location, `expected type ${allowedTypes.join(" or ")}, received ${typeOf(value)}`);
      return;
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    pushError(errors, location, `expected one of ${schema.enum.join(", ")}`);
  }

  if (schema.pattern && typeof value === "string") {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      pushError(errors, location, `does not match pattern ${schema.pattern}`);
    }
  }

  if (schema.minLength !== undefined && typeof value === "string" && value.length < schema.minLength) {
    pushError(errors, location, `expected minLength ${schema.minLength}`);
  }

  if (schema.minimum !== undefined && typeof value === "number" && value < schema.minimum) {
    pushError(errors, location, `expected minimum ${schema.minimum}`);
  }

  if (schema.maximum !== undefined && typeof value === "number" && value > schema.maximum) {
    pushError(errors, location, `expected maximum ${schema.maximum}`);
  }

  if (schema.format === "date-time" && !isValidDateTime(value)) {
    pushError(errors, location, "expected date-time format");
  }

  if (schema.type === "object" || schema.properties || schema.required) {
    if (typeOf(value) !== "object") {
      pushError(errors, location, `expected object, received ${typeOf(value)}`);
      return;
    }

    for (const requiredKey of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, requiredKey)) {
        pushError(errors, location, `missing required property ${requiredKey}`);
      }
    }

    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        await validateValue(value[key], childSchema, context, `${location}.${key}`, errors);
      }
    }

    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
          pushError(errors, `${location}.${key}`, "additional property is not allowed");
        }
      }
    }
  }

  if (schema.type === "array" || schema.items) {
    if (!Array.isArray(value)) {
      pushError(errors, location, `expected array, received ${typeOf(value)}`);
      return;
    }

    if (schema.uniqueItems) {
      const seen = new Set();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) {
          pushError(errors, location, "array items must be unique");
          break;
        }
        seen.add(key);
      }
    }

    if (schema.items) {
      for (let index = 0; index < value.length; index += 1) {
        await validateValue(value[index], schema.items, context, `${location}[${index}]`, errors);
      }
    }
  }
}

async function runValidation() {
  let hasFailure = false;
  const emittedWarnings = new Set();

  for (const target of validationTargets) {
    resolvedExternalRefs.clear();
    resolvedExampleSchemaRefs.clear();
    auditedSchemaRefs.clear();

    const schema = await loadSchema(target.schema);
    const sourceExample = await readJson(target.example);
    const example = invalidEngineeringRequestMode
      ? makeInvalidEngineeringRequest(sourceExample)
      : invalidEngineeringPlanMode || failureTestMode
      ? makeInvalidEngineeringPlan(sourceExample)
      : invalidRepositoryIntelligenceMode
      ? makeInvalidRepositoryIntelligence(sourceExample)
      : invalidEngineeringContextMode
      ? makeInvalidEngineeringContext(sourceExample)
      : invalidToolRequestMode
      ? makeInvalidToolRequest(sourceExample)
      : invalidToolResultMode
      ? makeInvalidToolResult(sourceExample)
      : invalidGateResultMode
      ? makeInvalidGateResult(sourceExample)
      : invalidSandboxRequestMode
      ? makeInvalidSandboxRequest(sourceExample)
      : invalidSandboxManifestMode
      ? makeInvalidSandboxManifest(sourceExample)
      : invalidSandboxResultMode
      ? makeInvalidSandboxResult(sourceExample)
      : invalidSandboxChangeMode ? makeInvalidSandboxChange(sourceExample)
      : invalidSandboxDiffMode ? makeInvalidSandboxDiff(sourceExample)
      : invalidSandboxEditResultMode ? makeInvalidSandboxEditResult(sourceExample)
      : invalidAuthoritySnapshotMode ? makeInvalidAuthoritySnapshot(sourceExample)
      : invalidMissionLockMode ? makeInvalidMissionLock(sourceExample)
      : invalidGovernanceDriftResultMode ? makeInvalidGovernanceDriftResult(sourceExample)
      : invalidDevOrchestrationCheckpointMode ? makeInvalidDevOrchestrationCheckpoint(sourceExample)
      : invalidDevOrchestrationRunMode ? makeInvalidDevOrchestrationRun(sourceExample)
      : invalidDurableRunRecordMode ? makeInvalidDurableRunRecord(sourceExample)
      : invalidDurableAuditEventMode ? makeInvalidDurableAuditEvent(sourceExample)
      : invalidDurableReplayResultMode ? makeInvalidDurableReplayResult(sourceExample)
      : invalidDurableRecoveryResultMode ? makeInvalidDurableRecoveryResult(sourceExample)
      : invalidStaticValidationRequestMode ? makeInvalidStaticValidationRequest(sourceExample)
      : invalidStaticValidationResultMode ? makeInvalidStaticValidationResult(sourceExample)
      : invalidEngineeringProposalMode ? makeInvalidEngineeringProposal(sourceExample)
      : invalidEngineeringBrainRequestMode ? makeInvalidEngineeringBrainRequest(sourceExample)
      : invalidEngineeringBrainResultMode ? makeInvalidEngineeringBrainResult(sourceExample)
      : invalidEngineeringLoopRequestMode ? makeInvalidEngineeringLoopRequest(sourceExample)
      : invalidEngineeringLoopResultMode ? makeInvalidEngineeringLoopResult(sourceExample)
      : invalidReviewedChangeRequestMode ? makeInvalidReviewedChangeRequest(sourceExample)
      : invalidReviewedChangeArtifactMode ? makeInvalidReviewedChangeArtifact(sourceExample)
      : invalidChangeReviewAttestationMode ? makeInvalidChangeReviewAttestation(sourceExample)
      : invalidChangeApprovalVerificationMode ? makeInvalidChangeApprovalVerification(sourceExample)
      : invalidControlledWriteRequestMode ? makeInvalidControlledWriteRequest(sourceExample)
      : invalidControlledWriteResultMode ? makeInvalidControlledWriteResult(sourceExample)
      : invalidWriteTransactionJournalMode ? makeInvalidWriteTransactionJournal(sourceExample)
      : invalidWriteRecoveryResultMode ? makeInvalidWriteRecoveryResult(sourceExample)
      : invalidContainerValidationRequestMode ? makeInvalidContainerValidationRequest(sourceExample)
      : invalidContainerValidationResultMode ? makeInvalidContainerValidationResult(sourceExample)
      : invalidStandaloneSessionRequestMode ? makeInvalidStandaloneSessionRequest(sourceExample)
      : invalidStandaloneSessionResultMode ? makeInvalidStandaloneSessionResult(sourceExample)
      : sourceExample;
    const errors = [];
    const warnings = [];

    await validateValue(
      example,
      schema,
      {
        schemaPath: path.resolve(target.schema),
        rootSchema: schema
      },
      "$",
      errors
    );

    await validateExampleSchemaRefs(example, target.example, errors);
    await auditSchemaReferenceGraph(target.schema, errors, warnings, "dev-agent");
    for (const refPath of resolvedExampleSchemaRefs) {
      await auditSchemaReferenceGraph(refPath, errors, warnings, "external");
    }

    if (errors.length > 0) {
      if (failureTestMode) {
        console.log(`EXPECTED_FAILURE ${path.relative(repoRoot, target.example)}`);
      } else {
        hasFailure = true;
        console.error(`FAILED ${path.relative(repoRoot, target.example)}`);
      }
      for (const error of errors) {
        const output = failureTestMode ? console.log : console.error;
        output(`- ${error}`);
      }
    } else {
      if (failureTestMode) {
        hasFailure = true;
        console.error(`FAILED ${path.relative(repoRoot, target.example)}`);
        console.error("- intentionally invalid engineering plan was accepted");
      } else {
        console.log(`PASSED ${path.relative(repoRoot, target.example)}`);
      }
    }

    if (hasExternalSchemaRef(schema) && resolvedExternalRefs.size === 0) {
      hasFailure = true;
      console.error(`FAILED ${path.relative(repoRoot, target.example)}`);
      console.error("- no external schema references were resolved");
    } else {
      for (const refPath of [...resolvedExternalRefs].sort()) {
        console.log(`RESOLVED ${path.relative(repoRoot, refPath)}`);
      }
    }

    for (const refPath of [...resolvedExampleSchemaRefs].sort()) {
      console.log(`RESOLVED ${path.relative(repoRoot, refPath)}`);
    }

    for (const warning of warnings) {
      if (!emittedWarnings.has(warning)) {
        emittedWarnings.add(warning);
        console.warn(`WARNING ${warning}`);
      }
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await runValidation();
}
