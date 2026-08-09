import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Department } from "../lib/departments";
import { getAllTasks } from "../lib/api";
import DepartmentCard from "../components/DepartmentCard";
import { LayoutDashboard, Sparkles, TrendingUp, CheckCircle2, Clock, Brain, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: deptData } = await supabase
        .from("departments")
        .select("*")
        .order("created_at");

      if (deptData) setDepartments(deptData);

      const tasks = await getAllTasks();
      if (tasks) {
        setStats({
          total: tasks.length,
          active: tasks.filter((t: { status: string }) =>
            ["pending", "in_progress"].includes(t.status)
          ).length,
          completed: tasks.filter((t: { status: string }) =>
            t.status === "completed"
          ).length,
        });
      }

      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles size={20} className="text-primary" />
          </div>
          <h1 className="font-heading text-3xl text-foreground tracking-tight">
            Forge<span className="text-primary">OS</span>
          </h1>
        </div>
        <p className="text-muted text-sm max-w-xl">
         Your AI WorkForce. One Command away
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl bg-surface border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard size={14} className="text-primary" />
            <span className="text-xs text-muted">Total Tasks</span>
          </div>
          <span className="text-2xl font-heading text-foreground">
            {loading ? "—" : stats.total}
          </span>
        </div>
        <div className="rounded-xl bg-surface border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-warning" />
            <span className="text-xs text-muted">Active</span>
          </div>
          <span className="text-2xl font-heading text-foreground">
            {loading ? "—" : stats.active}
          </span>
        </div>
        <div className="rounded-xl bg-surface border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-success" />
            <span className="text-xs text-muted">Completed</span>
          </div>
          <span className="text-2xl font-heading text-foreground">
            {loading ? "—" : stats.completed}
          </span>
        </div>
      </div>

      {/* NEW: Project Manager entry card */}
      <Link
        to="/project-manager"
        className="group block mb-10 p-6 rounded-2xl bg-gradient-to-br from-primary/15 via-surface to-surface border border-primary/30 transition-all duration-200 hover:border-primary/60 hover:shadow-lg hover:shadow-primary-glow cursor-pointer"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Brain size={22} className="text-primary" />
            </div>
            <div>
              <h3 className="font-heading text-base text-foreground flex items-center gap-2">
                Ask the Project Manager
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                  New
                </span>
              </h3>
              <p className="text-sm text-muted mt-0.5">
                Type any business goal — no department selection needed. The Project Manager decides who works on it.
              </p>
            </div>
          </div>
          <ArrowRight
            size={20}
            className="text-primary flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1"
          />
        </div>
      </Link>

      {/* Dept Grid */}
      <h2 className="font-heading text-lg text-foreground mb-4">Or pick a department directly</h2>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface border border-border p-6 animate-shimmer h-48"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {departments.map((dept) => (
            <DepartmentCard key={dept.id} department={dept} />
          ))}
        </div>
      )}

      {/* Empty state for first-time users */}
      {!loading && stats.total === 0 && (
        <div className="mt-10 text-center py-12 rounded-2xl bg-surface border border-border">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-elevated flex items-center justify-center">
            <Clock size={28} className="text-subtle" />
          </div>
          <h3 className="text-foreground font-heading text-lg mb-1">
            Ready to get started?
          </h3>
          <p className="text-muted text-sm max-w-sm mx-auto mb-4">
            Open any department and type a business goal. Your AI agents will break
            it down and produce real outputs.
          </p>
          <Link
            to="/department/marketing"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:shadow-primary-glow active:scale-[0.97] cursor-pointer"
          >
            <Sparkles size={16} />
            Try Marketing Team
          </Link>
        </div>
      )}
    </div>
  );
}
