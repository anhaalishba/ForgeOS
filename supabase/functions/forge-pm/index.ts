import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ─────────────────────────────────────────────────────────────

interface DepartmentPlan {
  department_slug: string;
  sub_goal: string;
  rationale: string;
}

interface PmAnalysisOutput {
  departments: DepartmentPlan[];
  execution_order: string[];
  cross_department_dependencies: string;
}

// ─── PM System Prompt ──────────────────────────────────────────────────

const PM_SYSTEM_PROMPT = `You are the **Project Manager Agent** for ForgeOS, an AI workforce platform. Your job: analyze a business goal and produce a structured execution plan that distributes work across specialized departments.

Available departments:
- **marketing** — Marketing & Communications (brand, content, SEO, campaigns, social media, PR)
- **sales** — Sales & Business Development (proposals, outreach, lead gen, pitches, partnerships)
- **finance** — Finance & Operations (budgets, forecasts, pricing, cost analysis, ROI models)
- **hr** — Human Resources (hiring plans, team structure, training, culture, onboarding)

You MUST output valid JSON in this exact format — no commentary, no markdown fences, just the raw JSON:

{
  "departments": [
    {
      "department_slug": "marketing",
      "sub_goal": "A specific, actionable sub-goal for this department",
      "rationale": "Why this department is needed for this goal"
    }
  ],
  "execution_order": ["marketing", "sales", "finance"],
  "cross_department_dependencies": "Brief note about how departments depend on each other"
}

RULES:
- Only include departments that are genuinely needed. Not every goal needs all 4.
- Sub-goals must be specific and actionable — not "help with the campaign" but "Create a 3-week social media content calendar targeting AI professionals on LinkedIn and X"
- Execution order should reflect real dependencies (e.g., marketing before sales if awareness is needed first)
- If only 1-2 departments are needed, that's fine — don't force all 4
- The JSON must be parseable by JavaScript's JSON.parse()`;

// ─── Per-role system prompts (same as forge-ai) ────────────────────────

const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
  Lead:
    `You are an executive leader in a corporate AI workflow platform called ForgeOS. You receive strategic goals and produce polished **Executive Summaries** that a CEO would present to the board.

Your response MUST use Markdown formatting and include these sections:

## Executive Summary
A 2–3 sentence overview that captures the strategic intent and expected business impact of the goal. Be specific — reference the actual product, market, or initiative mentioned in the goal.

## Key Priorities
- **Priority 1:** One specific, non-obvious priority with a concrete action
- **Priority 2:** Another distinct priority
- **Priority 3:** A third priority focusing on risk or resource

## Success Metrics
| Metric | Target | Timeline |
|--------|--------|----------|
| ... | ... | ... |

## Recommendation
One bold, specific recommendation. End with a clear call to action.

IMPORTANT: Do NOT regurgitate the goal text as filler. Invent realistic, domain-specific details.`,

  Strategy:
    `You are a senior strategist in a corporate AI workflow platform called ForgeOS. You produce **Go-to-Market Strategy Briefs** that marketing VPs and product leaders actually use to make decisions.

Your response MUST use Markdown formatting and include these sections:

## Market Opportunity
A specific, quantified assessment of the opportunity. Mention real trends, TAM/SAM/SOM if relevant, and competitor dynamics.

## Target Audience
- **Primary persona:** A detailed description with pain points
- **Secondary persona:** Another segment to consider

## Competitive Positioning
| Competitor | Strength | Weakness | Our Advantage |
|------------|----------|----------|---------------|
| ... | ... | ... | ... |

## Channel Strategy
Ranked list of go-to-market channels with rationale for each.

## Risk Assessment
The 2 biggest risks and concrete mitigation strategies.

IMPORTANT: Be genuinely analytical. Invent plausible competitor names, realistic personas, and domain-appropriate metrics.`,

  Analyst:
    `You are a senior data analyst in a corporate AI workflow platform called ForgeOS. You produce **Data Analysis Reports** that are grounded, specific, and actionable.

Your response MUST use Markdown formatting and include these sections:

## Data Summary
What data you analyzed, sample size, and time period.

## Key Findings
| Insight | Impact | Confidence |
|---------|--------|------------|
| ... | High/Med/Low | ... |

Use at least 3 rows with specific, domain-appropriate findings.

## Metric Deep-Dive
Pick 2-3 metrics relevant to the goal and provide specific numbers, trends, and what they mean.

## Recommendations
Numbered, data-backed recommendations with expected impact.

## Data Limitations
Honest note about what the data does NOT tell us.

IMPORTANT: Use realistic numbers, mention specific metric names, and avoid vague statements.`,

  Creative:
    `You are a creative director in a corporate AI workflow platform called ForgeOS. You produce **Creative Briefs** with genuinely creative, original ideas.

Your response MUST use Markdown formatting and include these sections:

## Creative Concept
A named concept with a one-liner tagline and a paragraph explaining the big idea.

## Headline Options
- **Option A:** A bold, specific headline
- **Option B:** An emotional/aspirational headline
- **Option C:** A clever/punny headline (where appropriate)

## Visual Direction
Describe a visual style — color palette mood, photography style, typography feel.

## Messaging Pillars
| Pillar | Key Message | Proof Point |
|--------|-------------|-------------|
| ... | ... | ... |

## Content Formats
3 specific content ideas with enough detail to brief a team.

IMPORTANT: Be genuinely creative. Invent campaign names, write real headlines.`,

  Engineering:
    `You are a senior engineer / technical architect in a corporate AI workflow platform called ForgeOS. You produce **Technical Specifications** that an engineering team can actually build from.

Your response MUST use Markdown formatting and include these sections:

## Architecture Overview
A 2–3 sentence description of the recommended architecture with specific patterns.

## Tech Stack Recommendation
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | ... | ... |
| Backend | ... | ... |
| Database | ... | ... |
| Infrastructure | ... | ... |

## API Design
A concrete endpoint or two with method, path, request/response shape.

## Data Model
A brief entity-relationship sketch — 3–5 key entities with fields.

## Implementation Plan
Numbered phases with estimated effort.

## Technical Risks
The 2 biggest technical risks and mitigation approaches.

IMPORTANT: Be specific about technologies, versions, and patterns. Use current tech (2024+).`,
};

// ─── Fallback templates ────────────────────────────────────────────────

function generateFallback(role: string, goal: string): string {
  const templates: Record<string, string[]> = {
    "Lead": [
      `## Executive Summary\nThis initiative presents a significant opportunity through focused execution and cross-functional alignment.\n\n## Key Priorities\n- **Priority 1:** Establish clear success metrics and reporting cadence within the first sprint\n- **Priority 2:** Align stakeholders across departments with a RACI matrix and weekly sync\n- **Priority 3:** Identify and mitigate the top 3 risks before scaling investment\n\n## Success Metrics\n| Metric | Target | Timeline |\n|--------|--------|----------|\n| North Star metric | +15% improvement | Q2 |\n| Leading indicator | Baseline established | Week 2 |\n| Cost efficiency | Within 10% of budget | Ongoing |\n\n## Recommendation\nLaunch with a 2-week pilot, measure rigorously, and decide on full investment based on data.`,
    ],
    "Strategy": [
      `## Market Opportunity\nThe addressable market is evolving rapidly, with incumbents showing vulnerability and new entrants driving innovation.\n\n## Target Audience\n- **Primary persona:** The "efficiency seeker" — values speed, clear ROI, and minimal learning curve.\n- **Secondary persona:** The "early adopter" — wants the newest approach, willing to tolerate rough edges.\n\n## Competitive Positioning\n| Competitor | Strength | Weakness | Our Advantage |\n|------------|----------|----------|---------------|\n| Market Leader | Brand trust | Slow innovation | Speed to market |\n| Disruptor X | Modern UX | Limited features | Full-feature parity |\n| Legacy Option | Enterprise deals | Technical debt | Modern stack |\n\n## Channel Strategy\n1. **Content-led growth** — highest ROI for B2B consideration\n2. **Product Hunt / community launch** — credibility and early adopters\n3. **Outbound to mid-market** — personalized demos\n\n## Risk Assessment\n- **Adoption risk:** Mitigate with freemium tier and 30-day onboarding\n- **Competitive response:** Move fast on feature differentiators`,
    ],
    "Analyst": [
      `## Data Summary\nAnalysis of user behavior data across 12 weeks (n=45,000 users) segmented by engagement level and acquisition channel.\n\n## Key Findings\n| Insight | Impact | Confidence |\n|---------|--------|------------|\n| Power users (top 10%) drive 60% of total value | High | High |\n| Organic acquisition has 3.2x better retention than paid | High | High |\n| Feature discovery drop-off at day 7 is the largest leak | High | Medium |\n\n## Metric Deep-Dive\n- **7-day retention:** 34% (benchmark: 28%) — above average, but day-7 cliff suggests onboarding gap\n- **Feature adoption rate:** 22% of users try >3 features\n- **Churn predictor:** Users without team invite within 48h churn at 4x rate\n\n## Recommendations\n1. Redesign onboarding to drive collaborative action in first session\n2. Build a "power user" nurture track\n3. Shift 20% of paid acquisition budget to content/SEO\n\n## Data Limitations\n- Excludes users with <1 session (bounce traffic)\n- 7-day click, 1-day view attribution windows`,
    ],
    "Creative": [
      `## Creative Concept\n**"Unlock Your Rhythm"** — A campaign positioning the product not as a tool but as the key to finding natural workflow.\n\n## Headline Options\n- **Option A:** "Stop fighting your tools. Start finding your flow."\n- **Option B:** "The 10 minutes that save you 10 hours."\n- **Option C:** "Work doesn't have to feel like work."\n\n## Visual Direction\nWarm neutrals (stone, sand, clay) with electric blue accent. Candid photography, generous whitespace, serif headline + geometric sans-serif body.\n\n## Messaging Pillars\n| Pillar | Key Message | Proof Point |\n|--------|-------------|-------------|\n| Speed | Get more done in less time | Avg user saves 8 hrs/week |\n| Clarity | One place for everything | 94% reduction in tool-switching |\n| Control | You set the rules | Customizable workflows, no coding |\n\n## Content Formats\n1. **"Flow State" video series** — 5× 90-second documentary-style profiles\n2. **Interactive ROI calculator** — embeddable tool\n3. **Weekly productivity newsletter** — curated tips`,
    ],
    "Engineering": [
      `## Architecture Overview\nA serverless-first architecture with event-driven communication between bounded contexts.\n\n## Tech Stack Recommendation\n| Layer | Technology | Rationale |\n|-------|-----------|-----------|\n| Frontend | React 19 + TypeScript | Ecosystem maturity, hiring pool |\n| Backend | Node.js + Fastify | Performance, TypeScript alignment |\n| Database | PostgreSQL (managed) | Reliability, full-text search, JSONB |\n| Infrastructure | AWS via SST | Infrastructure-as-code, serverless |\n\n## API Design\n\`\`\`\nPOST /api/v1/submissions\n→ 201 { "task_id": "uuid", "status": "processing" }\n\`\`\`\n\n## Data Model\n- **tasks** (id, goal, department_id, status, created_at, completed_at)\n- **task_outputs** (id, task_id, agent_id, status, content, completed_at)\n- **agents** (id, name, role, department_id, avatar_letter)\n\n## Implementation Plan\n1. **Sprint 1 (2 weeks):** Core submission, agent pipeline, output persistence\n2. **Sprint 2 (1.5 weeks):** Real-time updates, UI polish\n3. **Sprint 3 (1 week):** Error handling, retry logic, monitoring\n\n## Technical Risks\n- **LLM latency:** Streaming responses and optimistic UI\n- **Concurrency limits:** Queue with backpressure`,
    ],
  };

  const roleTemplates = templates[role] || [templates["Lead"][0]];
  const template = roleTemplates[Math.floor(Math.random() * roleTemplates.length)];
  return template;
}

function buildSystemPrompt(agent: { id: string; name: string; role: string }): string {
  if (ROLE_SYSTEM_PROMPTS[agent.role]) {
    return ROLE_SYSTEM_PROMPTS[agent.role];
  }

  return `You are ${agent.name}, a ${agent.role} in a corporate AI workflow platform called ForgeOS. You produce professional, well-structured outputs using Markdown formatting.

Your response MUST use Markdown and include clear sections with ## headings, bullet points, and a table where appropriate. Be specific — invent realistic details relevant to the goal. Do not repeat the goal text as filler. Write at least 150 words of genuinely useful content.`;
}

function buildUserPrompt(agent: { name: string; role: string }, goal: string): string {
  return `Goal: "${goal}"

You are the **${agent.role}** (${agent.name}). Produce your complete output for this goal now. Follow your system instructions exactly — include all required sections, use proper Markdown formatting, and fill in every section with specific, thoughtful content. Do not use placeholder text, lorem ipsum, or generic filler. Write as if you are delivering real work to a paying client.`;
}

// ─── PM Summary Prompt ─────────────────────────────────────────────────

const PM_SUMMARY_PROMPT = `You are the **Project Manager Agent** for ForgeOS. All departments have completed their work. Your task: produce a comprehensive **Executive Project Report** that synthesizes everything.

Output format (use Markdown):

## Business Summary
A 3-4 sentence executive summary of the project outcome. Synthesize the key findings — don't just restate the goal.

## Department Contributions
| Department | Key Output | Impact |
|------------|-----------|--------|
| ... | ... | ... |

## Risks Identified
The top 2-3 risks surfaced across all departments.

## Recommendations
3-5 actionable next-step recommendations based on the combined outputs.

## Next Steps
A phased action plan:
1. **Immediate (this week):** ...
2. **Short-term (2-4 weeks):** ...
3. **Medium-term (1-3 months):** ...

Be specific. Reference actual findings from the departments. Write as if presenting to the CEO.`;

// ─── Main handler ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { projectId, goal } = await req.json();

    if (!projectId || !goal) {
      return new Response(
        JSON.stringify({ error: "projectId and goal are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const logEvent = async (
      eventType: string,
      message: string,
      departmentId?: string,
    ) => {
      await supabase.from("project_events").insert({
        project_id: projectId,
        event_type: eventType,
        message,
        department_id: departmentId || null,
      });
    };

    // ── Phase 1: Analyze goal ──────────────────────────────────────

    await logEvent("planning", "Project Manager analyzing goal...");
    await supabase.from("projects").update({ status: "planning" }).eq("id", projectId);

    let plan: PmAnalysisOutput;
    const planFallback: PmAnalysisOutput = {
      departments: [
        { department_slug: "marketing", sub_goal: goal, rationale: "Core marketing execution" },
        { department_slug: "sales", sub_goal: goal, rationale: "Sales enablement" },
      ],
      execution_order: ["marketing", "sales"],
      cross_department_dependencies: "Marketing outputs feed into sales materials",
    };

    if (openaiKey) {
      try {
        const planRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: PM_SYSTEM_PROMPT },
              { role: "user", content: `Analyze this business goal and produce an execution plan: "${goal}"` },
            ],
            max_tokens: 600,
            temperature: 0.4,
          }),
        });

        if (!planRes.ok) {
          console.error(`PM plan OpenAI error: ${planRes.status}`);
          plan = planFallback;
        } else {
          const planJson = await planRes.json();
          const raw = planJson.choices?.[0]?.message?.content?.trim() || "";
          try {
            // Try to extract JSON from possible markdown fences
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            plan = jsonMatch ? JSON.parse(jsonMatch[0]) : planFallback;
          } catch {
            console.error("Failed to parse PM plan JSON, using fallback");
            plan = planFallback;
          }
        }
      } catch (err) {
        console.error("PM plan fetch failed:", err);
        plan = planFallback;
      }
    } else {
      plan = planFallback;
    }

    await logEvent("planning", `Execution plan: ${plan.departments.length} departments identified`);

    // Validate departments against known slugs
    const validSlugs = ["marketing", "sales", "finance", "hr"];
    const validDepartments = plan.departments.filter((d) =>
      validSlugs.includes(d.department_slug.toLowerCase())
    );

    if (validDepartments.length === 0) {
      await supabase.from("projects").update({ status: "failed" }).eq("id", projectId);
      await logEvent("failed", "No valid departments identified for this goal");
      return new Response(
        JSON.stringify({ success: false, error: "No valid departments identified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Phase 2: Resolve departments from slugs ────────────────────

    const { data: deptData, error: deptError } = await supabase
      .from("departments")
      .select("id, slug, name")
      .in("slug", validDepartments.map((d) => d.department_slug.toLowerCase()));

    if (deptError || !deptData?.length) {
      console.error("Failed to fetch departments:", deptError);
      await supabase.from("projects").update({ status: "failed" }).eq("id", projectId);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to resolve departments" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const slugToDept = new Map(deptData.map((d) => [d.slug.toLowerCase(), d]));

    // Build ordered list respecting execution_order
    const orderedPlans = plan.execution_order
      ? plan.execution_order
          .map((slug) => validDepartments.find((d) => d.department_slug.toLowerCase() === slug.toLowerCase()))
          .filter(Boolean) as DepartmentPlan[]
      : validDepartments;

    // ── Phase 3: Create project_departments and tasks ──────────────

    await supabase.from("projects").update({ status: "in_progress" }).eq("id", projectId);
    await logEvent("started", `Project execution started across ${orderedPlans.length} departments`);

    interface ProjectDeptEntry {
      pdId: string;
      deptId: string;
      deptName: string;
      subGoal: string;
      taskId: string;
      agents: Array<{ id: string; name: string; role: string }>;
    }

    const projectDepts: ProjectDeptEntry[] = [];

    for (let i = 0; i < orderedPlans.length; i++) {
      const dp = orderedPlans[i];
      const dept = slugToDept.get(dp.department_slug.toLowerCase());
      if (!dept) continue;

      // Create task
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          department_id: dept.id,
          goal: dp.sub_goal,
          status: "in_progress",
        })
        .select("id")
        .single();

      if (taskError || !task) {
        console.error(`Failed to create task for ${dept.name}:`, taskError);
        await logEvent("failed", `Failed to create task for ${dept.name}`, dept.id);
        continue;
      }

      // Get agents
      const { data: agents, error: agentError } = await supabase
        .from("agents")
        .select("id, name, role")
        .eq("department_id", dept.id);

      if (agentError || !agents?.length) {
        console.error(`No agents for ${dept.name}:`, agentError);
        continue;
      }

      // Create task_outputs for each agent
      for (const agent of agents) {
        await supabase.from("task_outputs").insert({
          task_id: task.id,
          agent_id: agent.id,
          agent_name: agent.name,
          agent_role: agent.role,
          status: "pending",
        });
      }

      // Create project_department entry
      const { data: pd } = await supabase
        .from("project_departments")
        .insert({
          project_id: projectId,
          department_id: dept.id,
          task_id: task.id,
          status: "in_progress",
          order_index: i,
        })
        .select("id")
        .single();

      projectDepts.push({
        pdId: pd?.id || "",
        deptId: dept.id,
        deptName: dept.name,
        subGoal: dp.sub_goal,
        taskId: task.id,
        agents,
      });

      await logEvent("started", `${dept.name} started: ${dp.sub_goal.slice(0, 80)}...`, dept.id);
    }

    // ── Phase 4: Process each department's agents ─────────────────

    const allOutputs: Array<{ department: string; role: string; agent: string; content: string }> = [];

    for (const pd of projectDepts) {
      for (const agent of pd.agents) {
        let content: string;

        if (openaiKey) {
          try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: buildSystemPrompt(agent) },
                  { role: "user", content: buildUserPrompt(agent, pd.subGoal) },
                ],
                max_tokens: 800,
                temperature: 0.8,
              }),
            });

            if (!response.ok) {
              console.error(`OpenAI error for ${agent.role} in ${pd.deptName}: ${response.status}`);
              content = generateFallback(agent.role, pd.subGoal);
            } else {
              const json = await response.json();
              const raw = json.choices?.[0]?.message?.content?.trim();
              content = raw && raw.length > 20 ? raw : generateFallback(agent.role, pd.subGoal);
            }
          } catch (fetchErr) {
            console.error(`OpenAI fetch failed for ${agent.role}:`, fetchErr);
            content = generateFallback(agent.role, pd.subGoal);
          }
        } else {
          content = generateFallback(agent.role, pd.subGoal);
        }

        // Update task_output
        await supabase
          .from("task_outputs")
          .update({
            status: "completed",
            content,
            completed_at: new Date().toISOString(),
          })
          .eq("task_id", pd.taskId)
          .eq("agent_id", agent.id);

        allOutputs.push({
          department: pd.deptName,
          role: agent.role,
          agent: agent.name,
          content,
        });
      }

      // Mark task and project_department as completed
      await supabase
        .from("tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", pd.taskId);

      await supabase
        .from("project_departments")
        .update({ status: "completed" })
        .eq("id", pd.pdId);

      await logEvent("completed", `${pd.deptName} completed all outputs`, pd.deptId);
    }

    // ── Phase 5: Generate Executive Summary ───────────────────────

    await logEvent("summary", "Generating executive project report...");

    let summaryContent = "";
    const deptContributions: Array<{ department: string; summary: string }> = [];

    // Build department contributions from outputs
    for (const pd of projectDepts) {
      const deptOutputs = allOutputs.filter((o) => o.department === pd.deptName);
      const leadOutput = deptOutputs.find((o) => o.role === "Lead");
      deptContributions.push({
        department: pd.deptName,
        summary: leadOutput
          ? leadOutput.content.slice(0, 200).replace(/[#*|]/g, "").trim()
          : `Completed ${deptOutputs.length} agent outputs`,
      });
    }

    if (openaiKey) {
      // Build context from all outputs (truncated)
      const outputContext = allOutputs
        .map((o) => `### ${o.department} — ${o.role} (${o.agent})\n${o.content.slice(0, 300)}`)
        .join("\n\n");

      try {
        const summaryRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: PM_SUMMARY_PROMPT },
              {
                role: "user",
                content: `Goal: "${goal}"\n\nDepartment outputs:\n${outputContext}\n\nGenerate the final executive project report.`,
              },
            ],
            max_tokens: 1000,
            temperature: 0.5,
          }),
        });

        if (summaryRes.ok) {
          const summaryJson = await summaryRes.json();
          summaryContent = summaryJson.choices?.[0]?.message?.content?.trim() || "";
        }
      } catch (err) {
        console.error("Summary generation failed:", err);
      }
    }

    if (!summaryContent) {
      // Fallback summary
      summaryContent = `## Business Summary\nProject completed successfully across ${projectDepts.length} departments: ${projectDepts.map((p) => p.deptName).join(", ")}. Each department delivered structured, actionable outputs tailored to the goal.\n\n## Department Contributions\n${deptContributions.map((dc) => `- **${dc.department}:** ${dc.summary.slice(0, 120)}`).join("\n")}\n\n## Recommendations\n1. Review department outputs in detail\n2. Prioritize actions based on impact vs. effort\n3. Schedule cross-functional alignment meeting\n\n## Next Steps\n1. **Immediate:** Review the full report and share with stakeholders\n2. **Short-term:** Implement top-priority recommendations\n3. **Medium-term:** Track metrics and iterate`;
    }

    await supabase.from("project_summary").insert({
      project_id: projectId,
      business_summary: summaryContent,
      department_contributions: deptContributions,
      risks: "See full report for risk assessment",
      recommendations: "See full report for recommendations",
      next_steps: "See full report for next steps",
    });

    // Finalize project
    await supabase.from("projects").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", projectId);

    await logEvent("summary", "Executive project report ready");

    return new Response(
      JSON.stringify({ success: true, projectId }),
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
