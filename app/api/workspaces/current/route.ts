import { NextResponse } from "next/server";
import { getWorkflowJobSteps, getWorkflowJobLogs, getWorkflowJobs, listWorkflowRuns } from "@/lib/github";
import { readSession } from "@/lib/session";

import { extractRuntime, runtimePhase, tailRuntimeLogs } from "@/lib/workspace-runtime";

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

    let runtime = { previewUrl: null as string | null, apiUrl: null as string | null, androidUrl: null as string | null, mobileRepo: null as string | null, mobileRef: null as string | null, apiRepo: null as string | null, apiRef: null as string | null, minutes: null as string | null, stage: null as string | null, android: false };
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
        logs = tailRuntimeLogs(rawLogs);
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
      runtime: { backend: Boolean(runtime.apiUrl), api_tunnel: Boolean(runtime.apiUrl), expo: Boolean(runtime.previewUrl), preview: Boolean(runtime.previewUrl), android: runtime.android },
        android_url: runtime.androidUrl,
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
