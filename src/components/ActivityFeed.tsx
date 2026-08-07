import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import type { ProjectEvent } from "../lib/departments";
import { Clock, Zap, CheckCircle2, FileText, Play } from "lucide-react";

interface ActivityFeedProps {
  events: ProjectEvent[];
}

const EVENT_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  planning: Zap,
  started: Play,
  completed: CheckCircle2,
  summary: FileText,
  failed: Clock,
};

const EVENT_COLORS: Record<string, string> = {
  planning: "text-primary",
  started: "text-[#F59E0B]",
  completed: "text-success",
  summary: "text-[#8B5CF6]",
  failed: "text-error",
};

export default function ActivityFeed({ events }: ActivityFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="text-sm text-muted p-4 text-center">
        <Clock size={20} className="mx-auto mb-2 text-subtle" />
        Waiting for project events...
      </div>
    );
  }

  return (
    <div
      className="max-h-72 overflow-y-auto space-y-1 pr-1"
      role="log"
      aria-live="polite"
      aria-label="Project activity feed"
    >
      <AnimatePresence initial={false}>
        {events.map((event) => {
          const Icon = EVENT_ICONS[event.event_type] || Clock;
          const iconColor = EVENT_COLORS[event.event_type] || "text-muted";

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0 }}
              className="flex items-start gap-2.5 py-1.5"
            >
              <div className="flex-shrink-0 mt-0.5">
                <Icon size={14} className={iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-relaxed">
                  {event.message}
                </p>
                <p className="text-[10px] text-subtle mt-0.5">
                  {new Date(event.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
