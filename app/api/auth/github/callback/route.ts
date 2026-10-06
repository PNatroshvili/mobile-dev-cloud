import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/session";
import { getGitHubUser } from "@/lib/github";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const store = await cookies();
  const savedState = store.get("github_oauth_state")?.value;
  store.delete("github_oauth_state");

  if (!code || !state || !savedState || state !== savedState) return NextResponse.json({ error: "Invalid OAuth state." }, { status: 400 });

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return NextResponse.json({ error: "GitHub OAuth is not configured." }, { status: 503 });

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  if (!tokenResponse.ok) return NextResponse.json({ error: "GitHub token exchange failed." }, { status: 502 });

  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) return NextResponse.json({ error: "GitHub did not return an access token." }, { status: 502 });

  const user = await getGitHubUser(tokenData.access_token);
  await createSession(tokenData.access_token, user.login);
  return NextResponse.redirect(new URL("/", request.url));
}
