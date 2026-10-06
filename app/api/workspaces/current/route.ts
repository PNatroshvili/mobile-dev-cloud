import { NextResponse } from "next/server";
import { getWorkflowJobSteps, getWorkflowJobLogs, getWorkflowJobs, listWorkflowRuns } from "@/lib/github";
import { readSession } from "@/lib/session";

function tailLogs(logs: string) {
  return logs
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-14);
}

function normalizeRun(run: {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_sha: string;
}) {
  return {
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    html_url: run.html_url,
    head_sha: run.head_sha,
  };
}
function extractRuntime(rawLogs: string) {
  const previewUrl = rawLogs.match(/Preview:\s+(https:\/\/[-a-z0-9]+\.trycloudflare\.com)/)?.[1] ?? null;
  const apiUrl = rawLogs.match(/API:\s+(https:\/\/[-a-z0-9]+\.trycloudflare\.com)/)?.[1] ?? null;
  const mobileRepo = rawLogs.match(/Workspace mobile repo:\s+([^\s]+)/)?.[1] ?? null;
  const mobileRef = rawLogs.match(/Workspace mobile ref:\s+([^\r\n]+)/)?.[1]?.trim() ?? null;
  const apiRepo = rawLogs.match(/Workspace API repo:\s+([^\s]+)/)?.[1] ?? null;
  const apiRef = rawLogs.match(/Workspace API ref:\s+([^\r\n]+)/)?.[1]?.trim() ?? null;
  const minutes = rawLogs.match(/Workspace minutes:\s+(\d+)/)?.[1] ?? null;
  const stages = [...rawLogs.matchAll(/Stage:\s+([^\r\n]+)/g)].map((match) => match[1].trim());
  return { previewUrl, apiUrl, mobileRepo, mobileRef, apiRepo, apiRef, minutes, stage: stages.at(-1) ?? null };
}


function runtimePhase(status: string, conclusion: string | null, step: string | null, stage: string | null) {
  if (status === "queued") return "queued";
  if (status === "completed") return conclusion === "success" ? "ready" : conclusion === "cancelled" ? "cancelled" : "failed";
  const value = `${step ?? ""} ${stage ?? ""}`.toLowerCase();
  if (value.includes("backend")) return "backend";
  if (value.includes("api tunnel")) return "api_tunnel";
  if (value.includes("expo")) return "expo";
  if (value.includes("preview")) return "preview";
  if (value.includes("cors") || value.includes("verif")) return "verifying";
  if (value.includes("workspace ready")) return "ready";
  if (value.includes("stop")) return "stopping";
  return "starting";
}

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const runs = await listWorkflowRuns(session.token, "workspace.yml");
    const run = runs.workflow_runs.find((candidate) => candidate.actor?.login === session.login) ?? null;

    if (!run) return NextResponse.json({ run: null });

    let runtime = { previewUrl: null as string | null, apiUrl: null as string | null, mobileRepo: null as string | null, mobileRef: null as string | null, apiRepo: null as string | null, apiRef: null as string | null, minutes: null as string | null, stage: null as string | null };
    let logs: string[] = [];
    let currentStep: string | null = null;
    let error: string | null = null;
    const jobs = await getWorkflowJobs(session.token, String(run.id));
    const workspaceJob = jobs.jobs.find((job) => job.name === "workspace");

    if (workspaceJob) {
      try {
        const stepData = await getWorkflowJobSteps(session.token, workspaceJob.id);
        const activeStep = stepData.steps.find((step) => step.status === "in_progress");
        const failedStep = stepData.steps.find((step) => step.conclusion === "failure");
        currentStep = activeStep?.name ?? failedStep?.name ?? null;
        if (failedStep && run.conclusion !== "success") error = `Runtime failed during: ${failedStep.name}`;
      } catch {
        // Step metadata can briefly lag behind the workflow job.
      }
    }

    if (workspaceJob && (workspaceJob.status === "in_progress" || run.status === "completed")) {
      try {
        const rawLogs = await getWorkflowJobLogs(session.token, workspaceJob.id);
        logs = tailLogs(rawLogs);
        runtime = extractRuntime(rawLogs);
      } catch {
        // Logs may not be available until GitHub finishes indexing the job.
      }
    }

    return NextResponse.json({
      run: {
        ...normalizeRun(run),
        preview_url: runtime.previewUrl,
        api_url: runtime.apiUrl,
        stage: currentStep ?? runtime.stage,
        phase: runtimePhase(run.status, run.conclusion, currentStep, runtime.stage),
        error,
        config: { mobile_repo: runtime.mobileRepo, mobile_ref: runtime.mobileRef, api_repo: runtime.apiRepo, api_ref: runtime.apiRef, minutes: runtime.minutes },
      runtime: { backend: Boolean(runtime.apiUrl), api_tunnel: Boolean(runtime.apiUrl), expo: Boolean(runtime.previewUrl), preview: Boolean(runtime.previewUrl), android: false },
        logs,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to recover workspace." },
      { status: 502 },
    );
  }
}
