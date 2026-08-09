import { supabase } from "./supabase";
import type { Agent, TaskOutput } from "./departments";

export async function submitTask(
  departmentId: string,
  goal: string,
  agents: Agent[]
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Create task
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      department_id: departmentId,
      goal,
      status: "in_progress",
    })
    .select()
    .single();

  if (taskError || !task) throw new Error("Failed to create task");

  // Create output records for each agent
  const outputs = agents.map((agent) => ({
    task_id: task.id,
    agent_id: agent.id,
    agent_name: agent.name,
    agent_role: agent.role,
    status: "pending" as const,
  }));

  const { error: outputsError } = await supabase
    .from("task_outputs")
    .insert(outputs);

  if (outputsError) throw new Error("Failed to create task outputs");

  // Call edge function to process
  const { error: fnError } = await supabase.functions.invoke("forge-ai", {
    body: { taskId: task.id, goal, agents },
  });

  if (fnError) {
    console.error("Edge function error:", fnError);
    // Don't fail — outputs will show as pending
  }

  return task.id;
}

export async function getTaskOutputs(taskId: string): Promise<TaskOutput[]> {
  const { data, error } = await supabase
    .from("task_outputs")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getDepartmentTasks(departmentId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("department_id", departmentId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getAllTasks() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("tasks")
    .select("*, department:departments(slug, name, color)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getAgents(departmentId: string): Promise<Agent[]> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("department_id", departmentId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}
// ── ADD THESE to your existing lib/api.ts (keep all existing functions as-is) ──

import type { ProjectManagerTask } from "./departments";

export async function submitProjectManagerGoal(goal: string): Promise<{
  projectManagerTaskId: string;
  departments: string[];
  reasoning: string;
  departmentTaskIds: Record<string, string>;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("project-manager", {
    body: { goal },
  });

  if (error) {
    console.error("Project Manager invoke error:", error);
    throw new Error("Project Manager could not process this goal. Please try again.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function getProjectManagerTask(id: string): Promise<ProjectManagerTask> {
  const { data, error } = await supabase
    .from("project_manager_tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function getAllProjectManagerTasks(): Promise<ProjectManagerTask[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("project_manager_tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
