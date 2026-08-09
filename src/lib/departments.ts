export interface Department {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface Agent {
  id: string;
  department_id: string;
  name: string;
  role: string;
  description: string;
  avatar_letter: string;
  system_prompt: string;
}

export interface Task {
  id: string;
  user_id: string;
  department_id: string;
  goal: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
  project_manager_task_id?: string | null;
}

export interface TaskOutput {
  id: string;
  task_id: string;
  agent_id: string;
  agent_name: string;
  agent_role: string;
  content: string | null;
  status: "pending" | "working" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
}

// NEW: Project Manager task type
export interface ProjectManagerTask {
  id: string;
  user_id: string;
  goal: string;
  departments: string[];
  reasoning: string | null;
  department_task_ids: Record<string, string> | null;
  status: "pending" | "in_progress" | "completed" | "failed";
  final_report: string | null;
  created_at: string;
  completed_at: string | null;
}

export const DEPARTMENT_COLORS: Record<string, string> = {
  marketing: "#F97316",
  hr: "#10B981",
  finance: "#F59E0B",
  sales: "#8B5CF6",
};

export const DEPARTMENT_GLOWS: Record<string, string> = {
  marketing: "rgba(249, 115, 22, 0.25)",
  hr: "rgba(16, 185, 129, 0.25)",
  finance: "rgba(245, 158, 11, 0.25)",
  sales: "rgba(139, 92, 246, 0.25)",
};
