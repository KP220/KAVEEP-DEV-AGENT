import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { askConfiguredSession, resolveDefaultProfile } from "./standalone-app.mjs";
import { runEnvironmentDoctor } from "../config/environment-doctor.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sessionPath = /^\/api\/sessions\/(durable_session_[A-Za-z0-9_-]+)\/cancel$/;

function send(response, code, value) {
  response.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(`${JSON.stringify(value)}\n`);
}

function stream(response, event, value) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
}

function redactedError(error) {
  return String(error.message).replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]");
}

async function body(request) {
  let value = "";
  for await (const chunk of request) {
    value += chunk;
    if (value.length > 65536) throw new Error("Request body is too large.");
  }
  return value ? JSON.parse(value) : {};
}

function page() {
  return `<!doctype html>
<meta charset="utf-8"><title>KAVEEP Command Center</title>
<style>body{font:16px system-ui;max-width:760px;margin:3rem auto;padding:0 1rem}.brand{display:flex;align-items:center;gap:1rem}.brand img{width:76px;height:76px;border-radius:50%;object-fit:cover}textarea{width:100%;height:7rem}button{margin:.5rem 0;padding:.6rem 1rem}pre{white-space:pre-wrap;background:#111;color:#ddd;padding:1rem}.notice{border-left:4px solid #d88b00;padding:.75rem;background:#fff7e5}</style>
<main><div class="brand"><img src="/kaveep-avatar.png" alt="KOSINCHAI Control Center avatar"><div><h1>KAVEEP DEV-AGENT</h1><p>KOSINCHAI Control Center</p></div></div>
<p>Local governed session interface. No source write or Git authority is granted here.</p>
<button id="doctor">Check readiness</button><textarea id="command" placeholder="Describe an engineering task in Thai or English"></textarea><button id="ask">Propose engineering work</button><button id="cancel" disabled>Cancel active session</button>
<p id="status" aria-live="polite">Ready.</p><section id="approval" class="notice" hidden><strong>Human approval required.</strong> This interface only presents the reviewed proposal; it cannot apply source changes.</section>
<h2>Session summary</h2><pre id="summary">No session yet.</pre><h2>Progress timeline</h2><pre id="events">No events yet.</pre></main>
<script>
const status=document.querySelector('#status'),summary=document.querySelector('#summary'),events=document.querySelector('#events'),approval=document.querySelector('#approval'),ask=document.querySelector('#ask'),cancel=document.querySelector('#cancel'),doctor=document.querySelector('#doctor'),command=document.querySelector('#command');let activeSessionId=null;
const show=value=>summary.textContent=JSON.stringify(value,null,2);
async function call(url,init){const r=await fetch(url,init);show(await r.json())}
doctor.onclick=()=>call('/api/doctor');
cancel.onclick=async()=>{if(!activeSessionId)return;cancel.disabled=true;status.textContent='Cancellation requested…';const r=await fetch('/api/sessions/'+encodeURIComponent(activeSessionId)+'/cancel',{method:'POST'});show(await r.json())};
function renderResult(value){const result=value.result??{},reviewed=result.artifacts?.reviewedChange;const compact={status:value.status,sessionId:value.sessionId,state:result.state,recommendedNextAction:result.recommendedNextAction,proposalId:result.artifacts?.engineeringLoop?.finalProposal?.proposalId??null,reviewedChange:reviewed?{status:reviewed.status,patchHash:reviewed.patchHash??null,changedFiles:reviewed.changedFiles??null}:null};show(compact);approval.hidden=value.status!=='awaiting_approval';status.textContent=value.status==='awaiting_approval'?'Proposal is ready for human review.':'Session completed: '+value.status;}
ask.onclick=async()=>{ask.disabled=true;cancel.disabled=true;approval.hidden=true;events.textContent='';status.textContent='Starting governed session…';try{const r=await fetch('/api/ask/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:command.value})});if(!r.ok){show(await r.json());status.textContent='Request failed.';return}const reader=r.body.getReader(),decoder=new TextDecoder();let text='';for(;;){const part=await reader.read();if(part.done)break;text+=decoder.decode(part.value,{stream:true});const frames=text.split('\\n\\n');text=frames.pop();for(const frame of frames){const name=frame.split('\\n').find(line=>line.startsWith('event: '))?.slice(7),data=frame.split('\\n').find(line=>line.startsWith('data: '));if(!data)continue;const value=JSON.parse(data.slice(6));if(name==='started'){activeSessionId=value.sessionId;cancel.disabled=false;status.textContent='Working: session started.'}else if(name==='progress'){events.textContent+=value.sequence+'. '+value.state+' — '+value.message+'\\n';status.textContent='Working: '+value.state}else if(name==='result')renderResult(value)}}}catch(error){show({status:'failed',error:String(error.message)});status.textContent='Connection failed.'}finally{activeSessionId=null;cancel.disabled=true;ask.disabled=false}};
</script>`;
}

export function createCommandCenterServer(options = {}) {
  const askSession = options.askSession ?? askConfiguredSession;
  const activeSessions = new Map();
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        response.end(page());
        return;
      }
      if (request.method === "GET" && url.pathname === "/kaveep-avatar.png") {
        response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
        response.end(await readFile(path.join(root, "web", "command-center", "kaveep-avatar.png")));
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/doctor") {
        const profile = resolveDefaultProfile(Object.fromEntries(url.searchParams));
        send(response, 200, await runEnvironmentDoctor(profile.configPath, options.doctorOptions ?? options));
        return;
      }
      const matchedSession = request.method === "POST" ? sessionPath.exec(url.pathname) : null;
      if (matchedSession) {
        const controller = activeSessions.get(matchedSession[1]);
        if (!controller) {
          send(response, 404, { status: "not_found", error: "Active session was not found." });
          return;
        }
        controller.abort(new Error("Session cancelled by the user."));
        send(response, 202, { status: "cancellation_requested", sessionId: matchedSession[1] });
        return;
      }
      if (request.method !== "POST" || !["/api/ask", "/api/ask/stream"].includes(url.pathname)) {
        send(response, 404, { status: "not_found" });
        return;
      }
      const payload = await body(request);
      if (!String(payload.command ?? "").trim()) {
        send(response, 400, { status: "failed", error: "Command is required." });
        return;
      }
      const schema = JSON.parse(await readFile(path.join(root, "schemas", "engineering-proposal.schema.json"), "utf8"));
      const input = { ...options, configPath: payload.configPath, authorityFile: payload.authorityFile, missionFile: payload.missionFile, proposalSchema: schema };
      if (url.pathname === "/api/ask") {
        const run = await askSession(payload.command, input);
        send(response, ["awaiting_approval", "no_action"].includes(run.status) ? 200 : 422, { status: run.status, sessionId: run.durable?.record?.durableSessionId ?? null, result: run.durable?.result ?? null, doctor: run.doctor ?? null });
        return;
      }
      const runId = `ui_${randomUUID().replace(/-/g, "")}`;
      const sessionId = `durable_session_${runId}`;
      const controller = new AbortController();
      activeSessions.set(sessionId, controller);
      response.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
      stream(response, "started", { sessionId });
      try {
        const run = await askSession(payload.command, { ...input, id: runId, signal: controller.signal, eventSink: async ({ event }) => stream(response, "progress", event) });
        stream(response, "result", { status: run.status, sessionId: run.durable?.record?.durableSessionId ?? sessionId, result: run.durable?.result ?? null });
      } catch (error) {
        stream(response, "result", { status: "failed", sessionId, error: redactedError(error) });
      } finally {
        activeSessions.delete(sessionId);
        response.end();
      }
    } catch (error) {
      send(response, 500, { status: "failed", error: redactedError(error) });
    }
  });
}

export async function serveCommandCenter(options = {}) {
  const server = createCommandCenterServer(options);
  const host = options.host ?? "127.0.0.1";
  const port = Number(options.port ?? 8765);
  await new Promise((resolve) => server.listen(port, host, resolve));
  return { server, url: `http://${host}:${server.address().port}/` };
}
