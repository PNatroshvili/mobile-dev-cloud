import { NextResponse } from "next/server";
import { getWorkflowJobs, getWorkflowJobLogs, getWorkflowRun } from "@/lib/github";
import { readSession } from "@/lib/session";

function tailLogs(logs: string) {
  return logs
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-14);
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId } = await params;
  if (!/^\d+$/.test(runId)) return NextResponse.json({ error: "Invalid workspace run ID." }, { status: 400 });

  try {
    const run = await getWorkflowRun(session.token, runId);
    if (run.actor?.login !== session.login) {
      return NextResponse.json({ error: "Workspace run does not belong to the connected GitHub account." }, { status: 403 });
    }

    let runtime = { previewUrl: null as string | null, apiUrl: null as string | null, mobileRepo: null as string | null, mobileRef: null as string | null, apiRepo: null as string | null, apiRef: null as string | null, minutes: null as string | null, stage: null as string | null };
    let logs: string[] = [];
    const jobs = await getWorkflowJobs(session.token, runId);
    const workspaceJob = jobs.jobs.find((job) => job.name === "workspace");

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
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url,
      head_sha: run.head_sha,
      preview_url: runtime.previewUrl,
      api_url: runtime.apiUrl,
      stage: runtime.stage,
      config: { mobile_repo: runtime.mobileRepo, mobile_ref: runtime.mobileRef, api_repo: runtime.apiRepo, api_ref: runtime.apiRef, minutes: runtime.minutes },
      logs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read workspace status." },
      { status: 502 },
    );
  }
}
