import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Circle, AlertTriangle } from "lucide-react";
import { DEPARTMENT_COLORS } from "../lib/departments";

interface DeptNode {
  slug: string;
  name: string;
  color: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

interface WorkflowGraphProps {
  goal: string;
  departments: DeptNode[];
  pmStatus: "planning" | "done";
  summaryStatus: "pending" | "generating" | "done";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed" || status === "done")
    return <CheckCircle2 size={16} className="text-success" />;
  if (status === "in_progress" || status === "generating")
    return <Loader2 size={16} className="animate-spin text-primary" />;
  if (status === "failed")
    return <AlertTriangle size={16} className="text-error" />;
  return <Circle size={16} className="text-subtle" />;
}

export default function WorkflowGraph({
  goal,
  departments,
  pmStatus,
  summaryStatus,
}: WorkflowGraphProps) {
  const allDeptsDone = departments.every((d) => d.status === "completed");

  return (
    <div className="flex flex-col items-center gap-0">
      {/* Goal Node */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="px-5 py-2.5 rounded-xl bg-elevated border border-border text-sm font-medium text-foreground"
      >
        {goal.length > 50 ? goal.slice(0, 50) + "..." : goal}
      </motion.div>

      {/* Connector */}
      <div className="w-px h-6 bg-border relative">
        <motion.div
          className="absolute inset-0 bg-primary origin-top"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: pmStatus === "done" ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* PM Node */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30"
      >
        <StatusIcon status={pmStatus} />
        <span className="text-sm font-medium text-primary">Project Manager</span>
      </motion.div>

      {/* Connector to departments */}
      <div className="relative w-full max-w-md h-8">
        {/* Vertical lines from PM to horizontal bar */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-px h-4 bg-border top-0"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: pmStatus === "done" ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          style={{ transformOrigin: "top" }}
        />
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-px h-4 bg-primary top-0"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: pmStatus === "done" ? 1 : 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          style={{ transformOrigin: "top" }}
        />
        {/* Horizontal bar */}
        {departments.length > 1 && (
          <motion.div
            className="absolute top-4 left-[15%] right-[15%] h-px bg-border"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: pmStatus === "done" ? 1 : 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            style={{ transformOrigin: "center" }}
          />
        )}
        {/* Individual drops to departments */}
        {departments.map((dept, i) => {
          const pct = departments.length === 1
            ? 50
            : ((i + 0.5) / departments.length) * 100;
          return (
            <motion.div
              key={dept.slug}
              className="absolute w-px h-4 bg-border top-4"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: pmStatus === "done" ? 1 : 0 }}
              transition={{ duration: 0.2, delay: 0.2 + i * 0.05 }}
              style={{ left: `${pct}%`, transformOrigin: "top" }}
            />
          );
        })}
      </div>

      {/* Department Nodes */}
      <div
        className="flex flex-wrap justify-center gap-3"
        style={{
          width: departments.length > 1 ? "100%" : "auto",
          maxWidth: "28rem",
        }}
      >
        <AnimatePresence>
          {departments.map((dept, i) => {
            const color = DEPARTMENT_COLORS[dept.slug] || "#3B82F6";
            return (
              <motion.div
                key={dept.slug}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.25 + i * 0.08 }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium"
                style={{
                  borderColor: `${color}40`,
                  background: dept.status === "in_progress" ? `${color}12` : "var(--color-surface)",
                  color: dept.status === "pending" ? "var(--color-muted)" : "var(--color-foreground)",
                  boxShadow: dept.status === "in_progress" ? `0 0 12px ${color}20` : "none",
                }}
              >
                <StatusIcon status={dept.status} />
                {dept.name}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Connector to summary */}
      {allDeptsDone && (
        <motion.div
          className="relative w-full max-w-md h-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {departments.map((dept, i) => {
            const pct = departments.length === 1
              ? 50
              : ((i + 0.5) / departments.length) * 100;
            return (
              <motion.div
                key={dept.slug}
                className="absolute w-px h-4 bg-border top-0"
                style={{ left: `${pct}%` }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
              />
            );
          })}
          {departments.length > 1 && (
            <motion.div
              className="absolute top-0 left-[15%] right-[15%] h-px bg-border"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 w-px h-4 bg-border top-4"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.2, delay: 0.3 }}
          />
        </motion.div>
      )}

      {/* Summary Node */}
      {allDeptsDone && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium ${
            summaryStatus === "done"
              ? "border-success/30 bg-success/5 text-success"
              : "border-border bg-surface text-muted"
          }`}
        >
          <StatusIcon status={summaryStatus === "done" ? "completed" : summaryStatus === "generating" ? "in_progress" : "pending"} />
          Executive Report
        </motion.div>
      )}
    </div>
  );
}
