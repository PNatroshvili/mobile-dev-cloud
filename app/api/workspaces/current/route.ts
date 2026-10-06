import { NextResponse } from "next/server";
import { listWorkflowRuns } from "@/lib/github";
import { readSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const runs = await listWorkflowRuns(session.token, "workspace.yml");
    const run = runs.workflow_runs.find((candidate) => candidate.actor?.login === session.login) ?? null;
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to recover workspace." }, { status: 502 });
  }
}
