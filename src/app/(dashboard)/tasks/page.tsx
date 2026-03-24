import { getTasks, getTeams } from "@/lib/queries";
import { TasksClient } from "./client";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, teams] = await Promise.all([getTasks(), getTeams()]);

  return <TasksClient initialTasks={tasks} initialTeams={teams} />;
}
