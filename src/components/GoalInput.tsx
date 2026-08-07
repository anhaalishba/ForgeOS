import { useState } from "react";
import { Send, Loader2 } from "lucide-react";

interface GoalInputProps {
  departmentColor: string;
  onSubmit: (goal: string) => Promise<void>;
  disabled?: boolean;
}

export default function GoalInput({
  departmentColor,
  onSubmit,
  disabled,
}: GoalInputProps) {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || loading || disabled) return;
    setLoading(true);
    try {
      await onSubmit(goal.trim());
      setGoal("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Describe what you want your team to accomplish..."
          rows={3}
          disabled={disabled || loading}
          className="w-full px-4 py-3 pr-14 rounded-xl bg-surface border border-border text-foreground placeholder:text-subtle text-sm resize-none transition-all duration-200 focus:outline-none focus:border-[var(--dept-color)] focus:ring-2 focus:ring-[var(--dept-glow)] disabled:opacity-50"
          style={
            {
              "--dept-color": departmentColor,
              "--dept-glow": `${departmentColor}30`,
            } as React.CSSProperties
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={!goal.trim() || loading || disabled}
          className="absolute right-3 bottom-3 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          style={{
            background: goal.trim() ? departmentColor : "transparent",
            color: goal.trim() ? "#fff" : "#5A6E8A",
          }}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </form>
  );
}
