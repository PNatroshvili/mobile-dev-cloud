export type WorkspaceRuntime = {
  previewUrl: string | null;
  apiUrl: string | null;
  androidUrl: string | null;
  mobileRepo: string | null;
  mobileRef: string | null;
  apiRepo: string | null;
  apiRef: string | null;
  minutes: string | null;
  stage: string | null;
  android: boolean;
  androidEmulator: boolean;
};

const emptyRuntime = (): WorkspaceRuntime => ({
  previewUrl: null,
  apiUrl: null,
  androidUrl: null,
  mobileRepo: null,
  mobileRef: null,
  apiRepo: null,
  apiRef: null,
  minutes: null,
  stage: null,
  android: false,
  androidEmulator: false,
});

function matchValue(rawLogs: string, pattern: RegExp) {
  return rawLogs.match(pattern)?.[1]?.trim() ?? null;
}

export function redactRuntimeSecrets(value: string) {
  return value
    .replace(/(Android:\s+https:\/\/[^\s?]+\/\?token=)[^\s]+/g, "$1***")
    .replace(/([?&]token=)[^&\s]+/g, "$1***")
    .replace(/(STREAM_TOKEN=)[^\s]+/g, "$1***");
}

export function tailRuntimeLogs(rawLogs: string, limit = 18) {
  return rawLogs
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .split("\n")
    .map((line) => redactRuntimeSecrets(line.trimEnd()))
    .filter(Boolean)
    .slice(-limit);
}

export function extractRuntime(rawLogs: string): WorkspaceRuntime {
  const runtime = emptyRuntime();
  runtime.previewUrl = matchValue(rawLogs, /Preview:\s+(https:\/\/[-a-z0-9]+\.trycloudflare\.com)/);
  runtime.apiUrl = matchValue(rawLogs, /API:\s+(https:\/\/[-a-z0-9]+\.trycloudflare\.com)/);
  runtime.androidUrl = matchValue(rawLogs, /Android:\s+(https:\/\/[-a-z0-9]+\.trycloudflare\.com\/\?token=[^\s]+)/);
  runtime.mobileRepo = matchValue(rawLogs, /Workspace mobile repo:\s+([^\s]+)/);
  runtime.mobileRef = matchValue(rawLogs, /Workspace mobile ref:\s+([^\r\n]+)/);
  runtime.apiRepo = matchValue(rawLogs, /Workspace API repo:\s+([^\s]+)/);
  runtime.apiRef = matchValue(rawLogs, /Workspace API ref:\s+([^\r\n]+)/);
  runtime.minutes = matchValue(rawLogs, /Workspace minutes:\s+(\d+)/);\n  runtime.androidEmulator = /Workspace Android emulator:\s+true/i.test(rawLogs);
  const stages = [...rawLogs.matchAll(/Stage:\s+([^\r\n]+)/g)].map((match) => match[1].trim());
  runtime.stage = stages.at(-1) ?? null;
  runtime.android = rawLogs.includes("Stage: Android browser stream ready");
  return runtime;
}

export function runtimePhase(
  status: string,
  conclusion: string | null,
  step: string | null,
  stage: string | null,
) {
  if (status === "queued") return "queued";
  if (status === "completed") {
    return conclusion === "success"
      ? "ready"
      : conclusion === "cancelled"
        ? "cancelled"
        : "failed";
  }

  const value = `${step ?? ""} ${stage ?? ""}`.toLowerCase();
  if (value.includes("android") && value.includes("build")) return "android_build";
  if (value.includes("android") && value.includes("stream")) return "android_stream";
  if (value.includes("backend")) return "backend";
  if (value.includes("api tunnel")) return "api_tunnel";
  if (value.includes("metro")) return "metro";
  if (value.includes("expo")) return "expo";
  if (value.includes("preview")) return "preview";
  if (value.includes("cors") || value.includes("verif")) return "verifying";
  if (value.includes("workspace ready")) return "ready";
  if (value.includes("stop")) return "stopping";
  return "starting";
}
