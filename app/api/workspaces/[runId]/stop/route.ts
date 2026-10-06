import { NextResponse } from "next/server";
import { cancelWorkflowRun, getWorkflowRun } from "@/lib/github";
import { readSession } from "@/lib/session";

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
    if (run.status === "completed") {
      return NextResponse.json({ ok: true, status: run.status, conclusion: run.conclusion });
    }

    await cancelWorkflowRun(session.token, runId);
    return NextResponse.json({ ok: true, status: "cancel_requested" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to stop workspace." },
      { status: 502 },
    );
  }
}
