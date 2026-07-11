import assert from "node:assert/strict";
import path from "node:path";
import { assessReleaseReadiness } from "../src/release/release-readiness.mjs";

const adapter = { async run(_file, args) { if (args.includes("--check")) return { code: 0, stdout: "", stderr: "" }; return { code: 0, stdout: JSON.stringify([{ files: Array.from({ length: 239 }, (_, index) => ({ path: `file-${index}` })) }]), stderr: "" }; } };
const report = await assessReleaseReadiness(path.resolve("."), { processAdapter: adapter, dockerCertificationStatus: "runtime_unavailable", dpapiCertificationStatus: "certified", clock: () => new Date("2026-07-11T00:00:00.000Z") });
assert.equal(report.status, "preview_ready_with_blockers"); assert.equal(report.installablePreview, true); assert.equal(report.productionReady, false); assert(report.blockers.includes("live_container_not_certified")); assert.equal(report.blockers.includes("dynamic_tool_using_engineering_loop_pending"), false); assert(report.blockers.includes("interactive_streaming_ux_pending")); assert(report.blockers.includes("multi_language_live_certification_pending")); assert.equal(report.blockers.includes("windows_dpapi_not_certified"), false); assert.equal(report.blockers.includes("concurrent_session_scaling_pending"), false); assert.equal(report.blockers.includes("package_dry_run_failed"), false); assert.equal(report.checks.find((item) => item.id === "module_syntax").status, "passed");
console.log("PASSED release readiness; package/bin/syntax inventory; installable preview; production blockers explicit and non-bypassable");
