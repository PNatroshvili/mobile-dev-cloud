export type GitHubRepo = {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  language?: string | null;
};

export type GitHubBranch = {
  name: string;
  protected: boolean;
};

const API = "https://api.github.com";

async function githubFetch<T>(path: string, token: string): Promise<T> {
  const response = await fetch(API + path, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getGitHubUser(token: string) {
  return githubFetch<{ login: string; avatar_url: string; name: string | null }>("/user", token);
}

export async function listRepositories(token: string) {
  return githubFetch<GitHubRepo[]>("/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member", token);
}

export async function listBranches(token: string, owner: string, repo: string) {
  return githubFetch<GitHubBranch[]>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`, token);
}

export async function dispatchWorkflow(
  token: string,
  workflowId: string,
  ref: string,
  inputs: Record<string, string>,
) {
  const response = await fetch(
    `${API}/repos/PNatroshvili/mobile-dev-cloud/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2026-03-10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref, inputs }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub workflow dispatch failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

export async function getWorkflowJobs(token: string, runId: string) {
  return githubFetch<{ jobs: Array<{ id: number; name: string; status: string; conclusion: string | null }> }>(
    `/repos/PNatroshvili/mobile-dev-cloud/actions/runs/${encodeURIComponent(runId)}/jobs?per_page=20`,
    token,
  );
}

export async function getWorkflowJobLogs(token: string, jobId: number) {
  const response = await fetch(
    `${API}/repos/PNatroshvili/mobile-dev-cloud/actions/jobs/${encodeURIComponent(String(jobId))}/logs`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`GitHub job logs returned ${response.status}`);
  return response.text();
}

export async function getWorkflowRun(token: string, runId: string) {
  return githubFetch<{
    id: number;
    status: string;
    conclusion: string | null;
    html_url: string;
    head_sha: string;
    actor?: { login: string };
  }>(`/repos/PNatroshvili/mobile-dev-cloud/actions/runs/${encodeURIComponent(runId)}`, token);
}

export async function listWorkflowRuns(token: string, workflowId?: string) {
  const suffix = workflowId ? `/actions/workflows/${encodeURIComponent(workflowId)}/runs?per_page=10` : "/actions/runs?per_page=10";
  return githubFetch<{ workflow_runs: Array<{
    id: number;
    status: string;
    conclusion: string | null;
    html_url: string;
    head_sha: string;
    created_at: string;
    actor?: { login: string };
  }> }>(`/repos/PNatroshvili/mobile-dev-cloud${suffix}`, token);
}
