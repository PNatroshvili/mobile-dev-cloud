import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  if (!clientId || !redirectUri) return NextResponse.json({ error: "GitHub OAuth is not configured." }, { status: 503 });

  const state = crypto.randomUUID();
  (await cookies()).set("github_oauth_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user repo",
    state,
  });
  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}
