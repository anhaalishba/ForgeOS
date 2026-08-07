import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Department, Agent, Task, TaskOutput } from "../lib/departments";
import { DEPARTMENT_COLORS } from "../lib/departments";
import {
  getAgents,
  getDepartmentTasks,
  submitTask,
  getTaskOutputs,
} from "../lib/api";
import GoalInput from "../components/GoalInput";
import TaskFlow from "../components/TaskFlow";
import TaskHistory from "../components/TaskHistory";
import {
  Megaphone,
  Users,
  DollarSign,
  TrendingUp,
  Building2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  Megaphone,
  Users,
  DollarSign,
  TrendingUp,
};

interface ActiveTaskView {
  task: Task;
  outputs: TaskOutput[];
}

export default function Department() {
  const { slug } = useParams<{ slug: string }>();
  const [department, setDepartment] = useState<Department | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeView, setActiveView] = useState<ActiveTaskView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const color = department
    ? DEPARTMENT_COLORS[department.color] || "#3B82F6"
    : "#3B82F6";

  const loadTasks = useCallback(async () => {
    if (!department) return;
    const data = await getDepartmentTasks(department.id);
    if (data) setTasks(data);
  }, [department]);

  useEffect(() => {
    async function load() {
      if (!slug) return;

      const { data: deptData } = await supabase
        .from("departments")
        .select("*")
        .eq("slug", slug)
        .single();

      if (!deptData) {
        setLoading(false);
        return;
      }

      setDepartment(deptData);
      const [agentData, taskData] = await Promise.all([
        getAgents(deptData.id),
        getDepartmentTasks(deptData.id),
      ]);

      setAgents(agentData || []);
      setTasks(taskData || []);
      setLoading(false);
    }
    load();
  }, [slug]);

  const handleSubmitGoal = async (goal: string) => {
    if (!department) return;

    setSubmitting(true);
    try {
      const taskId = await submitTask(department.id, goal, agents);
      await loadTasks();

      // Find the created task and set active view
      const { data: task } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (task) {
        setActiveView({ task, outputs: [] });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const outputs = await getTaskOutputs(taskId);
    setActiveView({ task, outputs });
  };

  const Icon = department ? (ICON_MAP[department.icon] || Building2) : Building2;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-shimmer h-8 w-48 rounded mb-4" />
        <div className="animate-shimmer h-64 rounded-2xl" />
      </div>
    );
  }

  if (!department) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <h2 className="font-heading text-xl text-foreground mb-2">
          Department not found
        </h2>
        <Link
          to="/dashboard"
          className="text-sm text-primary hover:underline"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb & Header */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-6 transition-colors duration-200"
      >
        <ArrowLeft size={14} />
        Dashboard
      </Link>

      <div
        className="flex items-center gap-4 mb-8 p-6 rounded-2xl bg-surface border border-border"
        style={{
          borderColor: `${color}30`,
          boxShadow: `0 0 30px ${color}08`,
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: `${color}15`,
            color: color,
          }}
        >
          <Icon size={28} />
        </div>
        <div>
          <h1 className="font-heading text-2xl text-foreground">
            {department.name}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {department.description}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-subtle">
              {agents.length} agents
            </span>
            <span className="text-xs text-subtle">·</span>
            <span className="text-xs text-subtle">
              {tasks.length} tasks
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Goal Input + Active Task */}
        <div className="lg:col-span-2 space-y-8">
          {/* Goal Input */}
          <div>
            <h2 className="font-heading text-lg text-foreground mb-3 flex items-center gap-2">
              <Sparkles size={18} className="text-[var(--dept-color)]" />
              Assign a Goal
            </h2>
            <GoalInput
              departmentColor={color}
              onSubmit={handleSubmitGoal}
              disabled={submitting}
            />
            {submitting && (
              <p className="text-xs text-muted mt-2">
                Your agents are assembling. This may take a moment...
              </p>
            )}
          </div>

          {/* Active Task Flow */}
          {activeView && (
            <div className="animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-lg text-foreground">
                  Current Task
                </h2>
                <button
                  onClick={() => setActiveView(null)}
                  className="text-xs text-muted hover:text-foreground cursor-pointer transition-colors duration-200"
                >
                  Close
                </button>
              </div>
              <div
                className="p-4 rounded-xl bg-elevated border border-border mb-4"
                style={{ borderColor: `${color}30` }}
              >
                <p className="text-sm text-foreground font-medium">
                  "{activeView.task.goal}"
                </p>
                <span className="text-xs text-muted mt-1 block">
                  {activeView.task.status === "completed"
                    ? "All agents have finished"
                    : activeView.task.status === "in_progress"
                    ? "Agents are working..."
                    : "Waiting to start"}
                </span>
              </div>
              <TaskFlow
                task={activeView.task}
                agents={agents}
                departmentColor={color}
              />
            </div>
          )}

          {/* Show active task if not selected */}
          {!activeView && tasks.find((t) => t.status === "in_progress") && (
            <div className="animate-fade-in-up">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted">
                  You have a task in progress
                </p>
                <button
                  onClick={() =>
                    handleSelectTask(
                      tasks.find((t) => t.status === "in_progress")!.id
                    )
                  }
                  className="text-xs text-[var(--dept-color)] font-medium cursor-pointer hover:underline"
                  style={{ color }}
                >
                  View progress
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Task History */}
        <div>
          <h2 className="font-heading text-lg text-foreground mb-3">
            Task History
          </h2>
          <TaskHistory
            tasks={tasks}
            departmentColor={color}
            onSelect={handleSelectTask}
            selectedTaskId={activeView?.task.id}
          />
        </div>
      </div>
    </div>
  );
}


