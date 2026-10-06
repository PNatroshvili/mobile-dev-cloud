import { NextResponse } from "next/server";
import { listRepositories } from "@/lib/github";
import { readSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ repos: await listRepositories(session.token) });
  } catch {
    return NextResponse.json({ error: "Unable to load GitHub repositories." }, { status: 502 });
  }
}
