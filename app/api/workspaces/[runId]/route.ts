import { NextResponse } from "next/server";
import { getWorkflowJobSteps, getWorkflowJobs, getWorkflowJobLogs, getWorkflowRun } from "@/lib/github";
import { readSession } from "@/lib/session";

import { extractRuntime, runtimePhase, tailRuntimeLogs } from "@/lib/workspace-runtime";

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

    let runtime = extractRuntime("");
    let logs: string[] = [];
    let currentStep: string | null = null;
    let error: string | null = null;
    const jobs = await getWorkflowJobs(session.token, runId);
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
        logs = tailRuntimeLogs(rawLogs);
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
      stage: currentStep ?? runtime.stage,
      phase: runtimePhase(run.status, run.conclusion, currentStep, runtime.stage),
      error,
      config: { mobile_repo: runtime.mobileRepo, mobile_ref: runtime.mobileRef, api_repo: runtime.apiRepo, api_ref: runtime.apiRef, minutes: runtime.minutes, android_emulator: runtime.androidEmulator },
      runtime: { backend: Boolean(runtime.apiUrl), api_tunnel: Boolean(runtime.apiUrl), expo: Boolean(runtime.previewUrl), preview: Boolean(runtime.previewUrl), android: runtime.android, android_emulator: runtime.androidEmulator },
      android_url: runtime.androidUrl,
      logs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read workspace status." },
      { status: 502 },
    );
  }
}
