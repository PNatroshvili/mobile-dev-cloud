import { NextResponse } from "next/server";
import { dispatchWorkflow, listWorkflowRuns } from "@/lib/github";
import { readSession } from "@/lib/session";

const PLATFORM_REPO = "mobile-dev-cloud";

function validRepo(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const mobileRepo = typeof body?.mobileRepo === "string" ? body.mobileRepo : null;
  const mobileRef = typeof body?.mobileRef === "string" ? body.mobileRef : null;
  const apiRepo = typeof body?.apiRepo === "string" ? body.apiRepo : null;
  const apiRef = typeof body?.apiRef === "string" ? body.apiRef : null;
  const minutes = String(body?.minutes ?? "30");

  if (!mobileRepo || !apiRepo || !mobileRef || !apiRef || !validRepo(mobileRepo) || !validRepo(apiRepo)) {
    return NextResponse.json({ error: "Invalid workspace configuration." }, { status: 400 });
  }

  const owner = session.login;
  if (!mobileRepo.startsWith(owner + "/") || !apiRepo.startsWith(owner + "/")) {
    return NextResponse.json({ error: "Only repositories owned by the connected GitHub account are supported by this workspace." }, { status: 403 });
  }

  if (!/^([5-9]|[1-5][0-9]|60)$/.test(minutes)) {
    return NextResponse.json({ error: "Workspace lifetime must be between 5 and 60 minutes." }, { status: 400 });
  }

  try {
    const existingRuns = await listWorkflowRuns(session.token, "workspace.yml");
    const activeRun = existingRuns.workflow_runs.find(
      (candidate) =>
        candidate.actor?.login === session.login &&
        (candidate.status === "queued" || candidate.status === "in_progress"),
    );

    if (activeRun) {
      return NextResponse.json(
        {
          error: "A workspace is already running for this GitHub account.",
          run: activeRun,
        },
        { status: 409 },
      );
    }

    const dispatchedAt = Date.now();
    await dispatchWorkflow(session.token, "workspace.yml", "main", {
      mobile_repo: mobileRepo,
      mobile_ref: mobileRef,
      api_repo: apiRepo,
      api_ref: apiRef,
      session_minutes: minutes,
    });

    let run = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const runs = await listWorkflowRuns(session.token, "workspace.yml");
      run = runs.workflow_runs.find((candidate) =>
        candidate.actor?.login === session.login &&
        Date.parse(candidate.created_at) >= dispatchedAt - 10_000,
      ) ?? null;
      if (run) break;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }

    return NextResponse.json({
      ok: true,
      repository: PLATFORM_REPO,
      status: run?.status ?? "queued",
      run,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start workspace." },
      { status: 502 },
    );
  }
}
