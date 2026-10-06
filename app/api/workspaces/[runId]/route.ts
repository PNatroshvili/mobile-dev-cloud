import { NextResponse } from "next/server";
import { getWorkflowJobs, getWorkflowJobLogs, getWorkflowRun } from "@/lib/github";
import { readSession } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId } = await params;
  if (!/^\d+$/.test(runId)) {
    return NextResponse.json({ error: "Invalid workspace run ID." }, { status: 400 });
  }

  try {
    const run = await getWorkflowRun(session.token, runId);
    let previewUrl: string | null = null;

    if (run.status === "completed" && run.conclusion === "success") {
      const jobs = await getWorkflowJobs(session.token, runId);
      const workspaceJob = jobs.jobs.find((job) => job.name === "workspace");
      if (workspaceJob) {
        const logs = await getWorkflowJobLogs(session.token, workspaceJob.id);
        previewUrl = logs.match(/Preview:\s+(https:\/\/[-a-z0-9]+\.trycloudflare\.com)/)?.[1] ?? null;
      }
    }

    return NextResponse.json({
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url,
      head_sha: run.head_sha,
      preview_url: previewUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read workspace status." },
      { status: 502 },
    );
  }
}
