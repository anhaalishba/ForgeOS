import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Department, Agent, Task } from "../lib/departments";
import { DEPARTMENT_COLORS } from "../lib/departments";
import { submitProjectManagerGoal, getAgents } from "../lib/api";
import TaskFlow from "../components/TaskFlow";
import {
  Sparkles,
  ArrowLeft,
  Brain,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface DeptRunState {
  slug: string;
  department: Department | null;
  agents: Agent[];
  task: Task | null;
}

export default function ProjectManager() {
  const [goal, setGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [chosenDepartments, setChosenDepartments] = useState<string[]>([]);
  const [deptRuns, setDeptRuns] = useState<DeptRunState[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    setReasoning(null);
    setChosenDepartments([]);
    setDeptRuns([]);

    try {
      const result = await submitProjectManagerGoal(goal);

      setReasoning(result.reasoning);
      setChosenDepartments(result.departments);

      // For each chosen department, fetch its details + agents + the created task
      const runs: DeptRunState[] = await Promise.all(
        result.departments.map(async (slug) => {
          const { data: deptData } = await supabase
            .from("departments")
            .select("*")
            .eq("slug", slug)
            .single();

          const taskId = result.departmentTaskIds[slug];
          let task: Task | null = null;
          if (taskId) {
            const { data: taskData } = await supabase
              .from("tasks")
              .select("*")
              .eq("id", taskId)
              .single();
            task = taskData;
          }

          const agents = deptData ? await getAgents(deptData.id) : [];

          return { slug, department: deptData || null, agents: agents || [], task };
        })
      );

      setDeptRuns(runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-6 transition-colors duration-200"
      >
        <ArrowLeft size={14} />
        Dashboard
      </Link>

      <div className="flex items-center gap-4 mb-8 p-6 rounded-2xl bg-surface border border-border">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-primary/15 text-primary">
          <Brain size={28} />
        </div>
        <div>
          <h1 className="font-heading text-2xl text-foreground">
            Ask the Project Manager
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Describe any business goal — the Project Manager decides which departments to involve, automatically.
          </p>
        </div>
      </div>

      {/* Goal input */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder='e.g. "Launch our product in the UAE" or "Grow revenue by 20% this quarter"'
            disabled={submitting}
            className="flex-1 px-4 py-3 rounded-xl bg-surface border border-border text-foreground text-sm placeholder:text-subtle focus:outline-none focus:border-primary transition-colors duration-200"
          />
          <button
            type="submit"
            disabled={submitting || !goal.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white text-sm font-semibold transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:shadow-primary-glow active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Thinking...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Send to Project Manager
              </>
            )}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-2">{error}</p>
        )}
      </form>

      {/* PM reasoning + routing */}
      {reasoning && (
        <div className="mb-8 animate-fade-in-up">
          <div className="p-5 rounded-2xl bg-elevated border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={16} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Project Manager's decision
              </span>
            </div>
            <p className="text-sm text-muted mb-4">{reasoning}</p>

            {/* Flow visualization */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-foreground">
                Goal
              </span>
              <ArrowRight size={14} className="text-subtle" />
              <span className="px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-xs font-medium text-primary">
                Project Manager
              </span>
              <ArrowRight size={14} className="text-subtle" />
              {chosenDepartments.map((slug, i) => (
                <span key={slug} className="flex items-center gap-2">
                  <span
                    className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize border"
                    style={{
                      background: `${DEPARTMENT_COLORS[slug]}15`,
                      borderColor: `${DEPARTMENT_COLORS[slug]}30`,
                      color: DEPARTMENT_COLORS[slug],
                    }}
                  >
                    {slug}
                  </span>
                  {i < chosenDepartments.length - 1 && (
                    <ArrowRight size={14} className="text-subtle" />
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Per-department task flows */}
      {deptRuns.length > 0 && (
        <div className="space-y-8">
          {deptRuns.map((run) =>
            run.task && run.department ? (
              <div key={run.slug} className="animate-fade-in-up">
                <h2
                  className="font-heading text-lg mb-3 capitalize"
                  style={{ color: DEPARTMENT_COLORS[run.slug] }}
                >
                  {run.department.name}
                </h2>
                <TaskFlow
                  task={run.task}
                  agents={run.agents}
                  departmentColor={DEPARTMENT_COLORS[run.slug] || "#3B82F6"}
                />
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
