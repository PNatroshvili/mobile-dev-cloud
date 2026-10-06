import { NextResponse } from "next/server";
import { getWorkflowJobLogs, getWorkflowJobs, listWorkflowRuns } from "@/lib/github";
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

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const runs = await listWorkflowRuns(session.token, "workspace.yml");
    const run = runs.workflow_runs.find((candidate) => candidate.actor?.login === session.login) ?? null;

    if (!run) return NextResponse.json({ run: null });

    let previewUrl: string | null = null;
    let logs: string[] = [];
    const jobs = await getWorkflowJobs(session.token, String(run.id));
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
      run: {
        ...normalizeRun(run),
        preview_url: previewUrl,
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
