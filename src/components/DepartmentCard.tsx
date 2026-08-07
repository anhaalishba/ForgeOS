import { Link } from "react-router-dom";
import type { Department } from "../lib/departments";
import { DEPARTMENT_COLORS, DEPARTMENT_GLOWS } from "../lib/departments";
import {
  Megaphone,
  Users,
  DollarSign,
  TrendingUp,
  Building2,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  Megaphone,
  Users,
  DollarSign,
  TrendingUp,
};

export default function DepartmentCard({ department }: { department: Department }) {
  const Icon = ICON_MAP[department.icon] || Building2;
  const color = DEPARTMENT_COLORS[department.color] || "#3B82F6";
  const glow = DEPARTMENT_GLOWS[department.color] || "rgba(59, 130, 246, 0.25)";
  const [activeTasks, setActiveTasks] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("tasks")
        .select("status")
        .eq("department_id", department.id)
        .eq("user_id", data.user.id)
        .then(({ data: tasks }) => {
          if (tasks) {
            setTotalTasks(tasks.length);
            setActiveTasks(
              tasks.filter((t) => t.status === "in_progress" || t.status === "pending").length
            );
          }
        });
    });
  }, [department.id]);

  const progressPercent =
    totalTasks > 0
      ? Math.round(
          ((totalTasks - activeTasks) / totalTasks) * 100
        )
      : 0;

  return (
    <Link
      to={`/department/${department.slug}`}
      className="group relative block p-6 rounded-2xl bg-surface border border-border hover:border-[var(--dept-color)] transition-all duration-300 cursor-pointer overflow-hidden"
      style={
        {
          "--dept-color": color,
          "--dept-glow": glow,
        } as React.CSSProperties
      }
    >
      {/* Glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${glow}, transparent 70%)`,
        }}
      />

      <div className="relative z-10">
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
          style={{
            background: `${color}15`,
            color: color,
          }}
        >
          <Icon size={24} />
        </div>

        {/* Title & Desc */}
        <h3 className="font-heading text-xl text-foreground mb-1 group-hover:text-[var(--dept-color)] transition-colors duration-200">
          {department.name}
        </h3>
        <p className="text-sm text-muted mb-4 line-clamp-2">
          {department.description}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-sm">
            <Clock size={14} className="text-subtle" />
            <span className="text-muted">
              {activeTasks} active
            </span>
          </div>
          <div className="text-sm text-subtle">
            {totalTasks} total tasks
          </div>
        </div>

        {/* Progress Bar */}
        {totalTasks > 0 && (
          <div className="h-1.5 rounded-full bg-elevated overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: color,
              }}
            />
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center gap-1 text-sm font-medium text-[var(--dept-color)] group-hover:gap-2 transition-all duration-200">
          Open Department
          <ChevronRight size={14} />
        </div>
      </div>
    </Link>
  );
}


