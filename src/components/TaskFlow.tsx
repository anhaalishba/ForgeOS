import { useState, useEffect, useCallback } from "react";
import type { Task, TaskOutput, Agent } from "../lib/departments";
import { supabase } from "../lib/supabase";
import { getTaskOutputs } from "../lib/api";
import AgentCard from "./AgentCard";

interface TaskFlowProps {
  task: Task;
  agents: Agent[];
  departmentColor: string;
}

export default function TaskFlow({ task, agents, departmentColor }: TaskFlowProps) {
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [allDone, setAllDone] = useState(false);

  const loadOutputs = useCallback(async () => {
    try {
      const data = await getTaskOutputs(task.id);
      setOutputs(data);
      if (data.every((o) => o.status === "completed" || o.status === "failed")) {
        setAllDone(true);
      }
    } catch (err) {
      console.error("Failed to load outputs:", err);
    }
  }, [task.id]);

  useEffect(() => {
    loadOutputs();

    if (task.status === "completed" || task.status === "failed") {
      return;
    }

    // Poll for updates
    const interval = setInterval(loadOutputs, 2000);
    return () => clearInterval(interval);
  }, [loadOutputs, task.status]);

  // Also listen for task completion
  useEffect(() => {
    if (task.status === "completed") {
      setAllDone(true);
      loadOutputs();
    }
  }, [task.status, loadOutputs]);

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel(`task-${task.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "task_outputs",
          filter: `task_id=eq.${task.id}`,
        },
        () => {
          loadOutputs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [task.id, loadOutputs]);

  // Map outputs to agents
  const agentOutputs = agents.map((agent, i) => {
    const output = outputs.find((o) => o.agent_id === agent.id);
    return {
      agent,
      output: output?.content ?? null,
      status: !output
  ? "idle"
  : output.status === "pending"
  ? "idle"
  : (output.status as "idle" | "working" | "completed" | "failed"),
      index: i,
    };
  });

  // If task is in_progress and no outputs yet, show all as working
  if (task.status === "in_progress" && outputs.length === 0) {
    return (
      <div className="space-y-4">
        {agents.map((agent, i) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            departmentColor={departmentColor}
            status="working"
            index={i}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted">
          {outputs.filter((o) => o.status === "completed").length} /{" "}
          {agents.length} agents completed
        </span>
        {allDone && (
          <span className="text-xs text-success font-medium px-2 py-0.5 rounded-full bg-success/10">
            All outputs ready
          </span>
        )}
      </div>

      {agentOutputs.map(({ agent, status, index, output: content }) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          departmentColor={departmentColor}
          status={status}
          output={content}
          index={index}
        />
      ))}
    </div>
  );
}
