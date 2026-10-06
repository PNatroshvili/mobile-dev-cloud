import { readSession } from "@/lib/session";
import { WorkspaceDashboard } from "@/app/components/workspace-dashboard";

export default async function Home() {
  const session = await readSession();
  return <WorkspaceDashboard connected={Boolean(session)} login={session?.login ?? null} />;
}
