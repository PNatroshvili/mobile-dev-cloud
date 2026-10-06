import { cookies } from "next/headers";

const COOKIE = "mdc_session";
const secret = () => process.env.SESSION_SECRET ?? "";

function b64(bytes: Uint8Array) { return Buffer.from(bytes).toString("base64url"); }
function unb64(value: string) { return new Uint8Array(Buffer.from(value, "base64url")); }

async function key() {
  if (secret().length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret()));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function createSession(token: string, login: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = JSON.stringify({ token, login, createdAt: Date.now() });
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(payload));
  (await cookies()).set(COOKIE, `${b64(iv)}.${b64(new Uint8Array(encrypted))}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800,
  });
}

export async function readSession() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  try {
    const [iv, encrypted] = value.split(".");
    const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(), unb64(encrypted));
    const session = JSON.parse(new TextDecoder().decode(data)) as { token: string; login: string; createdAt: number };
    return Date.now() - session.createdAt <= 604800000 ? session : null;
  } catch { return null; }
}

export async function clearSession() { (await cookies()).delete(COOKIE); }
