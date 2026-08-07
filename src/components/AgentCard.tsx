import type { Agent } from "../lib/departments";
import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Clock, AlertCircle } from "lucide-react";

interface AgentCardProps {
  agent: Agent;
  departmentColor: string;
  status?: "idle" | "working" | "completed" | "failed";
  output?: string | null;
  index: number;
}

export default function AgentCard({
  agent,
  departmentColor,
  status = "idle",
  output,
  index,
}: AgentCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  const statusConfig = {
    idle: {
      icon: Clock,
      className: "text-subtle",
      bg: "bg-elevated",
      label: "Idle",
    },
    working: {
      icon: Loader2,
      className: "text-[var(--dept-color)] animate-spin",
      bg: "bg-elevated",
      label: "Working...",
    },
    completed: {
      icon: CheckCircle2,
      className: "text-success",
      bg: "bg-success/10",
      label: "Done",
    },
    failed: {
      icon: AlertCircle,
      className: "text-error",
      bg: "bg-error/10",
      label: "Failed",
    },
  };

  const { icon: StatusIcon, className: statusClass, bg, label } =
    statusConfig[status];

  return (
    <div
      className={`rounded-xl bg-surface border border-border p-5 transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${status === "working" ? "agent-working border-[var(--dept-color)]" : ""} ${
        status === "completed" ? "border-success/30" : ""
      }`}
      style={{ "--dept-color": departmentColor } as React.CSSProperties}
    >
      {/* Agent Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold font-mono"
          style={{
            background: `${departmentColor}18`,
            color: departmentColor,
          }}
        >
          {agent.avatar_letter}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground text-sm truncate">
            {agent.name}
          </h4>
          <p className="text-xs text-muted truncate">{agent.role}</p>
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${bg}`}
        >
          <StatusIcon size={12} className={statusClass} />
          <span className={status === "working" ? "text-[var(--dept-color)]" : "text-muted"}>
            {label}
          </span>
        </div>
      </div>

      {/* Output Content */}
      {output && (
        <div className="mt-3 p-4 rounded-lg bg-elevated border border-border text-sm text-foreground whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto font-sans">
          {output}
        </div>
      )}

      {/* Loading Skeleton */}
      {status === "working" && !output && (
        <div className="mt-3 space-y-2">
          <div className="h-3 bg-elevated rounded animate-shimmer" />
          <div className="h-3 bg-elevated rounded animate-shimmer w-3/4" />
          <div className="h-3 bg-elevated rounded animate-shimmer w-1/2" />
        </div>
      )}
    </div>
  );
}
