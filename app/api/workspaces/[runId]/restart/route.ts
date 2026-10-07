import { NextResponse } from "next/server";
import { cancelWorkflowRun, dispatchWorkflow, getWorkflowJobLogs, getWorkflowJobs, getWorkflowRun, listWorkflowRuns } from "@/lib/github";
import { readSession } from "@/lib/session";
import { extractRuntime } from "@/lib/workspace-runtime";

const WORKFLOW = "workspace.yml";
const PLATFORM_REF = "main";

function validRepo(value: string | null): value is string {
  return Boolean(value && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(
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
    if (run.actor?.login !== session.login) {
      return NextResponse.json({ error: "Workspace run does not belong to the connected GitHub account." }, { status: 403 });
    }

    const jobs = await getWorkflowJobs(session.token, runId);
    const workspaceJob = jobs.jobs.find((job) => job.name === "workspace");
    if (!workspaceJob) {
      return NextResponse.json({ error: "Workspace job is not available yet; restart is temporarily unavailable." }, { status: 409 });
    }

    const rawLogs = await getWorkflowJobLogs(session.token, workspaceJob.id).catch(() => "");
    const runtime = extractRuntime(rawLogs);

    if (!validRepo(runtime.mobileRepo) || !validRepo(runtime.apiRepo) || !runtime.mobileRef || !runtime.apiRef || !runtime.minutes) {
      return NextResponse.json(
        { error: "Workspace configuration is not available yet. Wait for the runtime to emit its configuration markers, then retry restart." },
        { status: 409 },
      );
    }

    if (!runtime.mobileRepo.startsWith(session.login + "/") || !runtime.apiRepo.startsWith(session.login + "/")) {
      return NextResponse.json({ error: "Workspace repositories are not owned by the connected GitHub account." }, { status: 403 });
    }

    if (run.status !== "completed") {
      await cancelWorkflowRun(session.token, runId);

      for (let attempt = 0; attempt < 30; attempt += 1) {
        const latest = await getWorkflowRun(session.token, runId);
        if (latest.status === "completed") break;
        await sleep(1000);
      }

      const latest = await getWorkflowRun(session.token, runId);
      if (latest.status !== "completed") {
        return NextResponse.json(
          { error: "The previous workspace is still shutting down. Retry restart in a few seconds." },
          { status: 409 },
        );
      }
    }

    const dispatchedAt = Date.now();
    await dispatchWorkflow(session.token, WORKFLOW, PLATFORM_REF, {
      mobile_repo: runtime.mobileRepo,
      mobile_ref: runtime.mobileRef,
      api_repo: runtime.apiRepo,
      api_ref: runtime.apiRef,
      session_minutes: runtime.minutes,
      android_emulator: String(runtime.androidEmulator),
    });

    let newRun = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const runs = await listWorkflowRuns(session.token, WORKFLOW);
      newRun = runs.workflow_runs.find((candidate) =>
        candidate.actor?.login === session.login &&
        Date.parse(candidate.created_at) >= dispatchedAt - 10_000,
      ) ?? null;
      if (newRun) break;
      await sleep(1000);
    }

    return NextResponse.json({
      ok: true,
      status: newRun?.status ?? "queued",
      run: newRun,
      restarted_from: run.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to restart workspace." },
      { status: 502 },
    );
  }
}
