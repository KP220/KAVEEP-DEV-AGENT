import { randomUUID } from "node:crypto";
import { createProviderRegistry, createSessionRequest } from "../app/standalone-app.mjs";
import { cleanupSecureSandbox } from "../sandbox/secure-sandbox-manager.mjs";
import { runStandaloneSession } from "../session/standalone-engineering-session.mjs";

function usageFrom(result) {
  const loop = result.artifacts?.engineeringLoop;
  if (Array.isArray(loop?.attempts)) return loop.attempts.reduce((value, attempt) => ({ inputTokens: value.inputTokens + (attempt.brainResult?.usage?.inputTokens ?? 0), outputTokens: value.outputTokens + (attempt.brainResult?.usage?.outputTokens ?? 0) }), { inputTokens: 0, outputTokens: 0 });
  return { inputTokens: 0, outputTokens: 0 };
}

export async function evaluateLocalModel({ config, authoritySnapshot, missionLock, command, clock, registry, proposalSchema }) {
  if (config?.provider?.id !== "local-openai-compatible") throw new Error("Local model evaluation requires the local-openai-compatible provider.");
  const started = performance.now();
  const request = createSessionRequest(config, authoritySnapshot, missionLock, command, { id: `local_eval_${randomUUID().replace(/-/g, "")}`, clock });
  request.container = { ...request.container, enabled: false, required: false };
  request.loop = { ...request.loop, maxAttempts: 1, semanticMaxAttempts: 0 };
  const providerRegistry = registry ?? await createProviderRegistry(config);
  let result;
  let cleanup = "not_required";
  try { result = await runStandaloneSession(request, providerRegistry, { clock, proposalSchema }); }
  finally {
    if (result?.cleanupRequired && result.sandboxManifestRef) {
      try { await cleanupSecureSandbox(result.sandboxManifestRef); cleanup = "cleaned"; } catch { cleanup = "failed"; }
    }
  }
  return { localModelEvaluationId: `local_model_evaluation_${request.sessionRequestId.replace(/^standalone_session_request_/, "")}`, schemaVersion: "1.0.0", providerId: config.provider.id, model: config.provider.model, status: result?.status === "awaiting_approval" && cleanup !== "failed" ? "completed" : "blocked", sessionStatus: result?.status ?? "failed", durationMs: Math.round(performance.now() - started), usage: usageFrom(result ?? {}), sandboxCleanup: cleanup, reviewedChange: result?.artifacts?.reviewedChange ? { status: result.artifacts.reviewedChange.status, patchSha256: result.artifacts.reviewedChange.patchSha256, changes: result.artifacts.reviewedChange.changes.map((change) => ({ path: change.path, changeType: change.changeType })) } : null, errors: result?.errors ?? [], limitations: ["This evaluation runs exactly one proposal attempt with container validation disabled and cannot certify container isolation.", "The evaluated session only produces a reviewed sandbox artifact; it has no source-write, Git, release, or deployment authority.", "One successful local evaluation does not establish broad coding quality, cost, latency, or production readiness."], evaluatedAt: (clock?.() ?? new Date()).toISOString() };
}
