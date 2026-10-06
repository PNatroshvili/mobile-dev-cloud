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

    let previewUrl: string | null = null;
    let logs: string[] = [];
    const jobs = await getWorkflowJobs(session.token, runId);
    const workspaceJob = jobs.jobs.find((job) => job.name === "workspace");

    if (workspaceJob && (workspaceJob.status === "in_progress" || run.status === "completed")) {
      try {
        const rawLogs = await getWorkflowJobLogs(session.token, workspaceJob.id);
        logs = tailLogs(rawLogs);
        previewUrl = rawLogs.match(/Preview:\s+(https:\/\/[-a-z0-9]+\.trycloudflare\.com)/)?.[1] ?? null;
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
      preview_url: previewUrl,
      logs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read workspace status." },
      { status: 502 },
    );
  }
}
