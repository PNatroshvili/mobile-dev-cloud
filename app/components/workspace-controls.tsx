"use client";

import { useEffect, useMemo, useState } from "react";

type Repo = { id: number; full_name: string; private: boolean; default_branch: string };
type Branch = { name: string; protected: boolean };

export function WorkspaceControls({ connected }: { connected: boolean }) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [repo, setRepo] = useState("PNatroshvili/lukma-mobile");
  const [branch, setBranch] = useState("feature/home-discovery-foundation");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState("");
  const [runUrl, setRunUrl] = useState("");
  const [runId, setRunId] = useState<number | null>(null);
  const [runStatus, setRunStatus] = useState<string>("");
  const [runConclusion, setRunConclusion] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!connected) return;
    fetch("/api/github/repos")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { repos: Repo[] }) => setRepos(data.repos))
      .catch(() => setMessage("GitHub repositories could not be loaded."));
  }, [connected]);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const response = await fetch(`/api/workspaces/${runId}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setRunStatus(data.status ?? "");
        setRunConclusion(data.conclusion ?? null);
        if (data.html_url) setRunUrl(data.html_url);
        if (data.preview_url) setPreviewUrl(data.preview_url);
        if (data.status === "completed" && timer !== undefined) {
          window.clearInterval(timer);
          timer = undefined;
        }
      } catch {
        // Keep polling; transient status failures should not interrupt the workspace.
      }
    };

    void poll();
    timer = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [runId]);

  useEffect(() => {
    if (!connected || !repo) return;
    const [owner, name] = repo.split("/");
    if (!owner || !name) return;
    setLoading(true);
    fetch("/api/github/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name) + "/branches")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { branches: Branch[] }) => {
        setBranches(data.branches);
        if (data.branches.some((item) => item.name === branch)) return;
        setBranch(data.branches[0]?.name ?? "");
      })
      .catch(() => setMessage("Branches could not be loaded."))
      .finally(() => setLoading(false));
  }, [connected, repo]);

  const selectedRepo = useMemo(() => repos.find((item) => item.full_name === repo), [repos, repo]);

  async function startWorkspace() {
    if (!repo || !branch) return;
    setStarting(true);
    setMessage("");
    setRunUrl("");
    setRunId(null);
    setRunStatus("queued");
    setRunConclusion(null);
    setPreviewUrl("");
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
      if (data.run?.html_url) setRunUrl(data.run.html_url);
      if (data.run?.id) setRunId(data.run.id);
      if (data.run?.status) setRunStatus(data.run.status);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start workspace.");
    } finally {
      setStarting(false);
    }
  }

  if (!connected) {
    return <p className="hint">Connect GitHub to discover your repositories and branches.</p>;
  }

  return (
    <>
      <div className="controls">
        <label>
          Repository
          <select value={repo} onChange={(event) => setRepo(event.target.value)}>
            {repos.length === 0 && <option value={repo}>{repo}</option>}
            {repos.map((item) => <option key={item.id} value={item.full_name}>{item.full_name}</option>)}
          </select>
        </label>
        <label>
          Branch
          <select value={branch} onChange={(event) => setBranch(event.target.value)} disabled={loading}>
            {branches.length === 0 && <option value={branch}>{branch}</option>}
            {branches.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>
        </label>
      </div>
      <button className="primary" onClick={startWorkspace} disabled={starting || !selectedRepo || !branch}>
        {starting ? "Starting workspace…" : "Start workspace"}
      </button>
      {runStatus && (
        <p className="hint">
          Workspace: {runStatus === "completed" ? (runConclusion === "success" ? "ready" : `failed (${runConclusion ?? "unknown"})`) : runStatus}
        </p>
      )}
      {message && <p className="hint">{message}</p>}
      {previewUrl && (
        <p className="hint"><a href={previewUrl} target="_blank" rel="noreferrer">Open Live Preview →</a></p>
      )}
      {runUrl && <p className="hint"><a href={runUrl} target="_blank" rel="noreferrer">Open GitHub Actions run →</a></p>}
    </>
  );
}
