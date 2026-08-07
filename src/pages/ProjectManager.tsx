import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import type { Project, ProjectEvent, ProjectSummary } from "../lib/departments";
import { DEPARTMENT_COLORS } from "../lib/departments";
import {
  createProject,
  launchProject,
  getProject,
  getProjectDepartments,
  getProjectEvents,
  getProjectSummary,
} from "../lib/api";
import GoalInput from "../components/GoalInput";
import WorkflowGraph from "../components/WorkflowGraph";
import ActivityFeed from "../components/ActivityFeed";
import ExecutiveReport from "../components/ExecutiveReport";
import { Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

interface DeptNode {
  slug: string;
  name: string;
  color: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export default function ProjectManager() {
  const [project, setProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [deptNodes, setDeptNodes] = useState<DeptNode[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Cleanup polling
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (subRef.current) subRef.current.unsubscribe();
    };
  }, []);

  const startPolling = useCallback((projectId: string) => {
    // Subscribe to realtime
    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_events",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          getProjectEvents(projectId).then(setEvents);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
        },
        async () => {
          const p = await getProject(projectId);
          if (p) setProject(p);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_departments",
          filter: `project_id=eq.${projectId}`,
        },
        async () => {
          const pds = await getProjectDepartments(projectId);
          setDeptNodes(
            pds.map((pd) => ({
              slug: pd.department?.slug || "",
              name: pd.department?.name || "Unknown",
              color: pd.department?.color || "#3B82F6",
              status: pd.status as "pending" | "in_progress" | "completed" | "failed",
            }))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_summary",
          filter: `project_id=eq.${projectId}`,
        },
        async () => {
          const s = await getProjectSummary(projectId);
          if (s) setSummary(s);
        }
      )
      .subscribe();

    subRef.current = channel;

    // Also poll as backup
    pollRef.current = setInterval(async () => {
      const [p, evts, pds, sm] = await Promise.all([
        getProject(projectId),
        getProjectEvents(projectId),
        getProjectDepartments(projectId),
        getProjectSummary(projectId),
      ]);
      if (p) setProject(p);
      setEvents(evts);
      setDeptNodes(
        pds.map((pd) => ({
          slug: pd.department?.slug || "",
          name: pd.department?.name || "Unknown",
          color: pd.department?.color || "#3B82F6",
          status: pd.status as "pending" | "in_progress" | "completed" | "failed",
        }))
      );
      if (sm) setSummary(sm);

      // Stop polling if completed
      if (p?.status === "completed" || p?.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);
  }, []);

  const handleSubmit = async (inputGoal: string) => {
    setError(null);
    setSubmitting(true);

    try {
      // Create project
      const proj = await createProject(inputGoal);
      setProject(proj);

      // Launch PM edge function (non-blocking)
      launchProject(proj.id, inputGoal).catch((err) => {
        console.error("Launch failed:", err);
        setError("Project launch encountered an issue, but we're still trying...");
      });

      // Start polling after a short delay to let the function start
      setTimeout(() => startPolling(proj.id), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const pmStatus: "planning" | "done" =
    !project
      ? "planning"
      : project.status === "planning"
      ? "planning"
      : "done";

  const summaryStatus: "pending" | "generating" | "done" =
    !summary
      ? project?.status === "completed"
        ? "generating"
        : "pending"
      : "done";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-6 transition-colors duration-200"
      >
        <ArrowLeft size={14} />
        Dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl text-foreground flex items-center gap-2.5">
          <Sparkles size={24} className="text-primary" />
          AI Project Manager
        </h1>
        <p className="text-sm text-muted mt-1.5">
          Enter a business goal and let the AI coordinate all departments to deliver a complete plan.
        </p>
      </div>

      {/* Goal Input (only show if no active project) */}
      {!project && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <GoalInput
            departmentColor="#3B82F6"
            onSubmit={handleSubmit}
            disabled={submitting}
            placeholder="e.g. Launch a marketing campaign for an AI Resume Builder"
          />
          {submitting && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" />
              Project Manager is analyzing your goal...
            </div>
          )}
          {error && (
            <p className="text-sm text-error mt-3" role="alert">
              {error}
            </p>
          )}
        </motion.div>
      )}

      {/* Active Project View */}
      {project && (
        <div className="space-y-8">
          {/* Workflow Graph */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="p-6 rounded-2xl bg-surface border border-border"
          >
            <h2 className="font-heading text-base text-foreground mb-6 text-center">
              Execution Workflow
            </h2>
            <WorkflowGraph
              goal={project.goal}
              departments={deptNodes}
              pmStatus={pmStatus}
              summaryStatus={summaryStatus}
            />
          </motion.div>

          {/* Two-column: Activity + Report */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Activity Feed */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="p-4 rounded-2xl bg-surface border border-border"
            >
              <h2 className="font-heading text-sm text-foreground mb-3">
                Live Activity
              </h2>
              <ActivityFeed events={events} />
            </motion.div>

            {/* Main area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Executive Report */}
              {summary?.business_summary && (
                <ExecutiveReport content={summary.business_summary} />
              )}

              {/* Department Status Cards */}
              {deptNodes.length > 0 && !summary && (
                <div className="space-y-3">
                  <h2 className="font-heading text-base text-foreground">
                    Department Status
                  </h2>
                  {deptNodes.map((dept, i) => {
                    const color = DEPARTMENT_COLORS[dept.slug] || "#3B82F6";
                    return (
                      <motion.div
                        key={dept.slug}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.08 }}
                        className="flex items-center gap-3 p-3.5 rounded-xl border bg-elevated/50"
                        style={{
                          borderColor: `${color}30`,
                          boxShadow:
                            dept.status === "in_progress"
                              ? `0 0 16px ${color}10`
                              : "none",
                        }}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                          style={{
                            background: `${color}18`,
                            color,
                          }}
                        >
                          {dept.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {dept.name}
                          </p>
                          <p className="text-xs text-muted">
                            {dept.status === "completed"
                              ? "All outputs ready"
                              : dept.status === "in_progress"
                              ? "Agents working..."
                              : dept.status === "failed"
                              ? "Encountered an issue"
                              : "Waiting to start"}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {dept.status === "completed" && (
                            <span className="text-xs text-success font-medium">
                              ✓ Complete
                            </span>
                          )}
                          {dept.status === "in_progress" && (
                            <span className="flex items-center gap-1 text-xs text-primary">
                              <Loader2 size={10} className="animate-spin" />
                              Active
                            </span>
                          )}
                          {dept.status === "pending" && (
                            <span className="text-xs text-subtle">
                              Queued
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Loading state while waiting */}
              {deptNodes.length === 0 && !summary && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 size={32} className="animate-spin text-primary mb-4" />
                  <p className="text-sm text-muted">
                    Project Manager is analyzing your goal...
                  </p>
                  <p className="text-xs text-subtle mt-1">
                    This usually takes 5–15 seconds
                  </p>
                </div>
              )}

              {/* Completed state */}
              {project.status === "completed" && summary && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="text-center py-6"
                >
                  <p className="text-sm text-muted">
                    Project complete.
                  </p>
                  <button
                    onClick={() => {
                      setProject(null);
                      setEvents([]);
                      setSummary(null);
                      setDeptNodes([]);
                      if (pollRef.current) clearInterval(pollRef.current);
                      if (subRef.current) subRef.current.unsubscribe();
                    }}
                    className="mt-2 text-sm text-primary hover:underline cursor-pointer"
                  >
                    Start a new project
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
