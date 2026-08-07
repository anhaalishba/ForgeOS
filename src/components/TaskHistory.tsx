import type { Task } from "../lib/departments";
import { Clock, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TaskHistoryProps {
  tasks: Task[];
  departmentColor: string;
  onSelect: (taskId: string) => void;
  selectedTaskId?: string;
}

const STATUS_CONFIG = {
  pending: { icon: Clock, className: "text-subtle", label: "Pending" },
  in_progress: { icon: Clock, className: "text-[var(--dept-color)]", label: "In Progress" },
  completed: { icon: CheckCircle2, className: "text-success", label: "Completed" },
  failed: { icon: XCircle, className: "text-error", label: "Failed" },
};

export default function TaskHistory({
  tasks,
  departmentColor,
  onSelect,
  selectedTaskId,
}: TaskHistoryProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-elevated flex items-center justify-center">
          <Clock size={28} className="text-subtle" />
        </div>
        <h3 className="text-foreground font-heading text-lg mb-1">
          No tasks yet
        </h3>
        <p className="text-muted text-sm max-w-xs mx-auto">
          Assign a goal to this department and your AI agents will get to work.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const status = STATUS_CONFIG[task.status];
        const StatusIcon = status.icon;
        const isSelected = selectedTaskId === task.id;

        return (
          <button
            key={task.id}
            onClick={() => onSelect(task.id)}
            className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
              isSelected
                ? "border-[var(--dept-color)] bg-elevated"
                : "border-border bg-surface hover:border-border-light hover:bg-elevated/50"
            }`}
            style={{ "--dept-color": departmentColor } as React.CSSProperties}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium truncate">
                  {task.goal}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusIcon
                    size={12}
                    className={status.className}
                  />
                  <span className={`text-xs ${task.status === "in_progress" ? "text-[var(--dept-color)]" : "text-muted"}`}>
                    {status.label}
                  </span>
                  <span className="text-xs text-subtle">·</span>
                  <span className="text-xs text-subtle">
                    {formatDistanceToNow(new Date(task.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
              <ChevronRight
                size={16}
                className={`text-subtle transition-transform duration-200 ${
                  isSelected ? "rotate-90" : ""
                }`}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
