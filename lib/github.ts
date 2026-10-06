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
