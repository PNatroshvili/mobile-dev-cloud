"use client";

import { useEffect, useMemo, useState } from "react";

type Repo = { id: number; full_name: string; private: boolean; default_branch: string };
type Branch = { name: string; protected: boolean };

type WorkspaceData = {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_sha: string;
  preview_url: string | null;
  api_url: string | null;
  stage: string | null;
  phase: string;
  error: string | null;
  config: { mobile_repo: string | null; mobile_ref: string | null; api_repo: string | null; api_ref: string | null; minutes: string | null };
  logs: string[];
};

const services = [
  { name: "GitHub", detail: "Repository integration" },
  { name: "Workspace", detail: "Runtime orchestration" },
  { name: "Expo Preview", detail: "Live React Native Web preview" },
  { name: "Android Emulator", detail: "Browser-streamed Android" },
];

function statusLabel(status: string, conclusion: string | null) {
  if (status === "completed") {
    if (conclusion === "success") return "Ready";
    if (conclusion === "cancelled") return "Cancelled";
    return "Failed";
  }
  if (status === "queued") return "Queued";
  if (status === "in_progress") return "Running";
  return status ? status.replaceAll("_", " ") : "Waiting";
}

function statusTone(status: string, conclusion: string | null) {
  if (status === "completed" && conclusion === "cancelled") return "planned";
  if (status === "completed" && conclusion !== "success") return "error";
  if (status === "completed" || status === "in_progress") return "ready";
  return "planned";
}

export function WorkspaceDashboard({ connected, login }: { connected: boolean; login: string | null }) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [repo, setRepo] = useState("PNatroshvili/lukma-mobile");
  const [branch, setBranch] = useState("feature/home-discovery-foundation");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [message, setMessage] = useState("");
  const [run, setRun] = useState<WorkspaceData | null>(null);

  useEffect(() => {
    if (!connected) return;
    fetch("/api/github/repos")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { repos: Repo[] }) => setRepos(data.repos))
      .catch(() => setMessage("GitHub repositories could not be loaded."));
  }, [connected]);

  useEffect(() => {
    if (!connected || run) return;
    fetch("/api/workspaces/current", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { run?: WorkspaceData | null } | null) => {
        if (data?.run) {
          setRun(data.run);
          if (data.run.config.mobile_repo) setRepo(data.run.config.mobile_repo);
          if (data.run.config.mobile_ref) setBranch(data.run.config.mobile_ref);
          setMessage("Recovered your latest workspace session.");
        }
      })
      .catch(() => {});
  }, [connected, run]);

  useEffect(() => {
    if (!connected || !repo) return;
    const [owner, name] = repo.split("/");
    if (!owner || !name) return;
    setLoading(true);
    fetch("/api/github/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name) + "/branches")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { branches: Branch[] }) => {
        setBranches(data.branches);
        if (!data.branches.some((item) => item.name === branch)) setBranch(data.branches[0]?.name ?? "");
      })
      .catch(() => setMessage("Branches could not be loaded."))
      .finally(() => setLoading(false));
  }, [connected, repo, branch]);

  useEffect(() => {
    if (!run?.id) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const response = await fetch("/api/workspaces/" + run.id, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as WorkspaceData;
        if (cancelled) return;
        setRun(data);
        if (data.status === "completed" && timer !== undefined) {
          window.clearInterval(timer);
          timer = undefined;
        }
      } catch {
        // Keep polling through transient network failures.
      }
    };

    void poll();
    timer = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [run?.id]);

  const selectedRepo = useMemo(() => repos.find((item) => item.full_name === repo), [repos, repo]);
  const active = Boolean(run && run.status !== "completed");
  const tone = statusTone(run?.status ?? "", run?.conclusion ?? null);
  const label = statusLabel(run?.status ?? "", run?.conclusion ?? null);
  const preview = run?.preview_url ?? "";
  const apiUrl = run?.api_url ?? "";
  const stage = run?.stage ?? label;
  const phase = run?.phase ?? "starting";
  const runtimeError = run?.error ?? "";

  async function startWorkspace() {
    if (!repo || !branch) return;
    setStarting(true);
    setMessage("");
    setRun(null);
    try {
      const response = await fetch("/api/workspaces/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobileRepo: repo,
          mobileRef: branch,
          apiRepo: "PNatroshvili/lukma-api",
          apiRef: "feat/auth-api",
          minutes: "30",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start workspace.");
      setMessage(data.status === "in_progress" ? "Workspace is starting." : "Workspace queued.");
      if (data.run?.id) {
        setRun({
          id: data.run.id,
          status: data.run.status ?? "queued",
          conclusion: data.run.conclusion ?? null,
          html_url: data.run.html_url ?? "",
          head_sha: data.run.head_sha ?? "",
          preview_url: null,
          api_url: null,
          stage: "Starting backend",
          phase: "backend",
          error: null,
          config: { mobile_repo: repo, mobile_ref: branch, api_repo: "PNatroshvili/lukma-api", api_ref: "feat/auth-api", minutes: "30" },
          logs: [],
        });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start workspace.");
    } finally {
      setStarting(false);
    }
  }

  async function refreshWorkspace() {
    if (!run?.id) return;
    setMessage("Refreshing workspace status…");
    try {
      const response = await fetch("/api/workspaces/" + run.id, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to refresh workspace.");
      setRun(data as WorkspaceData);
      setMessage("Workspace status refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh workspace.");
    }
  }

  async function stopWorkspace() {
    if (!run?.id || stopping) return;
    setStopping(true);
    setMessage("");
    try {
      const response = await fetch("/api/workspaces/" + run.id + "/stop", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to stop workspace.");
      setMessage(data.status === "completed" ? "Workspace has already finished." : "Stop requested. Workspace is shutting down.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to stop workspace.");
    } finally {
      setStopping(false);
    }
  }

  const terminalLines = run?.logs?.length
    ? run.logs
    : run
      ? [
          "$ mobile-dev-cloud start lukma",
          "> workspace " + (run.status === "completed" ? (run.conclusion === "success" ? "ready" : run.conclusion === "cancelled" ? "cancelled" : "failed") : run.status),
          "> waiting for runtime logs…",
        ]
      : [
          "$ mobile-dev-cloud start lukma",
          "> workspace not started",
          "> connect GitHub and start a workspace",
        ];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">SKUP / MOBILE DEV CLOUD</div>
          <h1>Build mobile apps from your browser.</h1>
          <p className="subtitle">Connect GitHub, start a workspace, and preview React Native / Expo changes live.</p>
        </div>
        <div className="top-actions">
          <div className="connection"><span className="dot" /> Control plane online</div>
          {connected ? <div className="account">GitHub · <strong>{login}</strong></div> : <a className="github-button" href="/api/auth/github">Connect GitHub</a>}
        </div>
      </header>

      <section className="hero-grid">
        <div className="card workspace-card">
          <div className="card-head">
            <div><span className="label">WORKSPACE</span><h2>LUKMA</h2></div>
            <span className={"pill " + (active ? "" : "muted")}>{connected ? (active ? "Runtime active" : "GitHub connected") : "Connect GitHub first"}</span>
          </div>
          <div className="repo-row">
            <div className="repo-icon">GH</div>
            <div><strong>{repo}</strong><span>React Native · Expo · TypeScript</span></div>
          </div>

          {!connected ? (
            <p className="hint">Connect GitHub to discover your repositories and branches.</p>
          ) : (
            <>
              <div className="controls">
                <label>Repository
                  <select value={repo} onChange={(event) => setRepo(event.target.value)} disabled={active}>
                    {repos.length === 0 && <option value={repo}>{repo}</option>}
                    {repos.map((item) => <option key={item.id} value={item.full_name}>{item.full_name}</option>)}
                  </select>
                </label>
                <label>Branch
                  <select value={branch} onChange={(event) => setBranch(event.target.value)} disabled={loading || active}>
                    {branches.length === 0 && <option value={branch}>{branch}</option>}
                    {branches.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="workspace-actions">
                <button className="primary" onClick={startWorkspace} disabled={starting || stopping || active || !selectedRepo || !branch}>
                  {starting ? "Starting workspace…" : active ? "Workspace running" : "Start new workspace"}
                </button>
                {active && <button className="secondary danger" onClick={stopWorkspace} disabled={stopping}>{stopping ? "Stopping…" : "Stop workspace"}</button>}
                {run && !active && <button className="secondary" onClick={refreshWorkspace}>Refresh status</button>}
              </div>
              <div className="workspace-meta">
                <span className={"status " + tone}>{label}</span>
                {run?.head_sha && <span>commit {run.head_sha.slice(0, 7)}</span>}
                {run?.id && <span>run #{run.id}</span>}
                {stage && <span>{stage}</span>}
                <span>phase {phase.replaceAll("_", " ")}</span>
              </div>
              {message && <p className="hint">{message}</p>}
              {runtimeError && <p className="hint error-copy">{runtimeError}</p>}
              {run?.html_url && <p className="hint"><a href={run.html_url} target="_blank" rel="noreferrer">Open GitHub Actions run →</a></p>}
            </>
          )}
        </div>

        <div className={"card preview-card " + (preview ? "preview-ready" : "")}>
          <div className="card-head">
            <div><span className="label">LIVE PREVIEW</span><h2>Browser device</h2></div>
            <span className={"pill " + (preview ? "" : "muted")}>{preview ? "Live" : label}</span>
          </div>
          <div className="device-wrap">
            {preview ? (
              <iframe className="preview-frame" src={preview} title="LUKMA live preview" allow="clipboard-read; clipboard-write" />
            ) : (
              <div className="phone">
                <div className="notch" />
                <div className="phone-screen">
                  <span className="preview-logo">LUKMA</span>
                  <span className="preview-copy">{active ? "Booting your workspace…" : "Your mobile preview will appear here."}</span>
                  {active && <span className="preview-loader" />}
                </div>
              </div>
            )}
          </div>
          <div className="preview-links">
            {preview && <a className="preview-link" href={preview} target="_blank" rel="noreferrer">Open preview in a new tab ↗</a>}
            {apiUrl && <a className="preview-link" href={apiUrl} target="_blank" rel="noreferrer">Open API ↗</a>}
          </div>
        </div>
      </section>

      <section className="lower-grid">
        <div className="card terminal">
          <div className="card-head">
            <div><span className="label">TERMINAL</span><h2>Workspace console</h2></div>
            <span className={"pill " + (run ? "" : "muted")}>{run ? label : "Waiting"}</span>
          </div>
          <pre><code>{terminalLines.join("\n")}</code></pre>
        </div>

        <div className="card">
          <div className="card-head"><div><span className="label">SERVICES</span><h2>Runtime stack</h2></div></div>
          <div className="service-list">
            {services.map((service, index) => {
              const serviceStatus = !run ? (index === 0 ? "Ready" : "Planned") : index === 0 ? "Ready" : index === 1 ? (run.status === "completed" && run.conclusion === "cancelled" ? "Stopped" : run.status === "completed" && run.conclusion !== "success" ? "Error" : run.api_url ? "Live" : active ? "Booting" : "Ready") : index === 2 ? (preview ? "Live" : active ? "Booting" : "Ready") : "Planned";
              const serviceClass = serviceStatus === "Error" ? "status error" : serviceStatus === "Planned" || serviceStatus === "Stopped" ? "status planned" : "status ready";
              return <div className="service" key={service.name}><div><strong>{service.name}</strong><span>{service.detail}</span></div><span className={serviceClass}>{serviceStatus}</span></div>;
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
