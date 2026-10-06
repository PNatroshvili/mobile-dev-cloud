import { NextResponse } from "next/server";
import { listBranches } from "@/lib/github";
import { readSession } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ owner: string; repo: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { owner, repo } = await context.params;
  try {
    return NextResponse.json({ branches: await listBranches(session.token, owner, repo) });
  } catch {
    return NextResponse.json({ error: "Unable to load branches." }, { status: 502 });
  }
}
