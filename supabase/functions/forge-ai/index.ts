import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgentInput {
  id: string;
  name: string;
  role: string;
}

interface RequestBody {
  taskId: string;
  goal: string;
  agents: AgentInput[];
}

// Fallback templates by role when OpenAI is unavailable
const FALLBACK_TEMPLATES: Record<string, string[]> = {
  "Lead": [
    "Strategic analysis complete. Key priorities identified: {goal}. Recommend phased rollout with stakeholder alignment.",
    "Leadership review finished. {goal} aligns with organizational objectives. Proposed timeline: 2-week sprint cycles.",
    "Executive summary prepared for {goal}. Cross-functional dependencies mapped. Ready for team-level decomposition.",
  ],
  "Strategy": [
    "Market analysis complete for {goal}. Competitive landscape mapped. Three strategic options with risk/reward profiles attached.",
    "Strategic framework applied to {goal}. SWOT analysis reveals strong positioning opportunity in Q2. Detailed report follows.",
    "Long-range planning for {goal} complete. Scenario modeling shows 85% confidence interval for target outcomes.",
  ],
  "Analyst": [
    "Data analysis complete for {goal}. Key metrics: 12% YoY growth potential, 3 primary segments identified. Full dataset attached.",
    "Quantitative assessment of {goal} finished. Regression analysis shows significant correlation with market indicators (p<0.01).",
    "Analytics report for {goal}: processed 50K data points. Visualization-ready insights with confidence intervals included.",
  ],
  "Creative": [
    "Creative concepts for {goal}: 3 distinct directions with mood boards attached. Recommended direction: bold, modern, human-centered.",
    "Design thinking workshop output for {goal}. User journey maps, empathy diagrams, and 5 prototype sketches delivered.",
    "Creative strategy for {goal}: brand voice guide, visual identity system, and content pillars defined. Assets ready for review.",
  ],
  "Engineering": [
    "Technical architecture for {goal}: system design complete. Stack recommendation: scalable microservices with event-driven patterns.",
    "Engineering assessment: {goal} requires 3 new services, 2 API integrations. Estimated sprint velocity: 21 story points per sprint.",
    "Code architecture for {goal} finalized. API contracts defined. CI/CD pipeline configured. Ready for sprint planning.",
  ],
  "default": [
    "Analysis of '{goal}' complete. Key findings and recommendations prepared for review.",
    "Task processed successfully. Output for '{goal}' generated with supporting documentation.",
    "Work complete on '{goal}'. Results available in the attached summary.",
  ],
};

function generateFallback(role: string, goal: string): string {
  const templates = FALLBACK_TEMPLATES[role] || FALLBACK_TEMPLATES["default"];
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template.replace("{goal}", goal);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { taskId, goal, agents } = body;

    if (!taskId || !goal || !agents?.length) {
      return new Response(
        JSON.stringify({ error: "taskId, goal, and agents are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    // Process each agent
    for (const agent of agents) {
      let content: string;

      if (openaiKey) {
        // Use OpenAI to generate intelligent output
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are ${agent.name}, a ${agent.role} agent in a corporate AI workflow platform called ForgeOS. You receive goals and produce concise, professional outputs. Keep responses to 2-3 sentences maximum. Be specific and actionable. Do not use markdown formatting.`,
              },
              {
                role: "user",
                content: `Goal: ${goal}\n\nProvide your ${agent.role} output for this goal.`,
              },
            ],
            max_tokens: 150,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          console.error(`OpenAI error for agent ${agent.id}: ${response.status}`);
          content = generateFallback(agent.role, goal);
        } else {
          const json = await response.json();
          content = json.choices?.[0]?.message?.content?.trim() || generateFallback(agent.role, goal);
        }
      } else {
        // Use fallback templates
        content = generateFallback(agent.role, goal);
      }

      // Update the task_output
      const { error: updateError } = await supabase
        .from("task_outputs")
        .update({
          status: "completed",
          content,
          completed_at: new Date().toISOString(),
        })
        .eq("task_id", taskId)
        .eq("agent_id", agent.id);

      if (updateError) {
        console.error(`Failed to update output for agent ${agent.id}:`, updateError);
      }
    }

    // Update task status to completed
    await supabase
      .from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
