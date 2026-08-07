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

// ─── Validation helpers ────────────────────────────────────────────────

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function formatSupabaseError(err: unknown): string {
  if (!err) return "Unknown database error";
  if (typeof err === "string") return err;
  const e = err as Record<string, unknown>;
  if (e.message) return String(e.message);
  if (e.details) return String(e.details);
  if (e.hint) return String(e.hint);
  if (e.code) return `Database error code: ${e.code}`;
  return JSON.stringify(err);
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

    // ── Pre-flight: Resolve project and user ───────────────────────────

    console.log("[forge-pm] Step 0: Looking up project", projectId);

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, user_id, goal")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("[forge-pm] Project lookup failed:", formatSupabaseError(projectError));
      return new Response(
        JSON.stringify({ success: false, error: `Project not found: ${formatSupabaseError(projectError)}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = project.user_id;
    console.log("[forge-pm] Project found, user_id:", userId);

    const logEvent = async (
      eventType: string,
      message: string,
      departmentId?: string,
    ) => {
      console.log(`[forge-pm] Event: [${eventType}] ${message}`);
      const { error: evtErr } = await supabase.from("project_events").insert({
        project_id: projectId,
        event_type: eventType,
        message,
        department_id: departmentId || null,
      });
      if (evtErr) {
        console.error("[forge-pm] Failed to log event:", formatSupabaseError(evtErr));
      }
    };

    // ── Phase 1: Analyze goal ──────────────────────────────────────

    await logEvent("planning", "Project Manager analyzing goal...");
    console.log("[forge-pm] Step 1: Analyzing goal");
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
          console.error(`[forge-pm] PM plan OpenAI error: ${planRes.status}`);
          plan = planFallback;
        } else {
          const planJson = await planRes.json();
          const raw = planJson.choices?.[0]?.message?.content?.trim() || "";
          try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            plan = jsonMatch ? JSON.parse(jsonMatch[0]) : planFallback;
          } catch {
            console.error("[forge-pm] Failed to parse PM plan JSON, using fallback");
            plan = planFallback;
          }
        }
      } catch (err) {
        console.error("[forge-pm] PM plan fetch failed:", err);
        plan = planFallback;
      }
    } else {
      console.log("[forge-pm] No OPENAI_API_KEY — using fallback plan");
      plan = planFallback;
    }

    await logEvent("planning", `Execution plan: ${plan.departments.length} departments identified`);
    console.log("[forge-pm] Plan departments:", plan.departments.map((d) => d.department_slug).join(", "));

    // Validate departments against known slugs
    const validSlugs = ["marketing", "sales", "finance", "hr"];
    const validDepartments = plan.departments.filter((d) =>
      validSlugs.includes(d.department_slug.toLowerCase())
    );

    if (validDepartments.length === 0) {
      console.error("[forge-pm] No valid departments identified");
      await supabase.from("projects").update({ status: "failed" }).eq("id", projectId);
      await logEvent("failed", "No valid departments identified for this goal");
      return new Response(
        JSON.stringify({ success: false, error: "No valid departments identified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Phase 2: Resolve departments from slugs ────────────────────

    console.log("[forge-pm] Step 2: Resolving departments from slugs");

    const { data: deptData, error: deptError } = await supabase
      .from("departments")
      .select("id, slug, name")
      .in("slug", validDepartments.map((d) => d.department_slug.toLowerCase()));

    if (deptError || !deptData?.length) {
      console.error("[forge-pm] Failed to fetch departments:", formatSupabaseError(deptError));
      await supabase.from("projects").update({ status: "failed" }).eq("id", projectId);
      await logEvent("failed", `Failed to resolve departments: ${formatSupabaseError(deptError)}`);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to resolve departments" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[forge-pm] Resolved departments:", deptData.map((d) => d.slug).join(", "));

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
    const failedDepts: Array<{ name: string; error: string }> = [];

    for (let i = 0; i < orderedPlans.length; i++) {
      const dp = orderedPlans[i];
      const dept = slugToDept.get(dp.department_slug.toLowerCase());

      if (!dept) {
        const msg = `Department slug "${dp.department_slug}" not found in database`;
        console.error(`[forge-pm] ${msg}`);
        await logEvent("failed", msg);
        failedDepts.push({ name: dp.department_slug, error: msg });
        continue;
      }

      // Validate IDs before insert
      if (!isValidUUID(dept.id)) {
        const msg = `Invalid department UUID: ${dept.id}`;
        console.error(`[forge-pm] ${msg}`);
        await logEvent("failed", msg, dept.id);
        failedDepts.push({ name: dept.name, error: msg });
        continue;
      }

      if (!isValidUUID(projectId)) {
        const msg = `Invalid project UUID: ${projectId}`;
        console.error(`[forge-pm] ${msg}`);
        await logEvent("failed", msg, dept.id);
        failedDepts.push({ name: dept.name, error: msg });
        continue;
      }

      if (!isValidUUID(userId)) {
        const msg = `Invalid user UUID: ${userId}`;
        console.error(`[forge-pm] ${msg}`);
        await logEvent("failed", msg, dept.id);
        failedDepts.push({ name: dept.name, error: msg });
        continue;
      }

      // ── Create task ───────────────────────────────────────────

      console.log(`[forge-pm] Step 3a: Creating task for ${dept.name} (user_id=${userId}, dept_id=${dept.id})`);
      await logEvent("started", `Creating ${dept.name} task...`, dept.id);

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          department_id: dept.id,
          goal: dp.sub_goal,
          status: "in_progress",
        })
        .select("id")
        .single();

      if (taskError || !task) {
        const errMsg = formatSupabaseError(taskError);
        console.error(`[forge-pm] FAILED to create task for ${dept.name}:`, errMsg);
        await logEvent("failed", `Failed to create task for ${dept.name}: ${errMsg}`, dept.id);
        failedDepts.push({ name: dept.name, error: errMsg });
        continue;
      }

      console.log(`[forge-pm] Task created: ${task.id}`);
      await logEvent("started", `${dept.name} task created (${task.id})`, dept.id);

      // ── Fetch agents ──────────────────────────────────────────

      console.log(`[forge-pm] Step 3b: Fetching agents for ${dept.name}`);
      const { data: agents, error: agentError } = await supabase
        .from("agents")
        .select("id, name, role")
        .eq("department_id", dept.id);

      if (agentError || !agents?.length) {
        const errMsg = agentError
          ? formatSupabaseError(agentError)
          : `No agents found for department ${dept.name}`;
        console.error(`[forge-pm] Agent fetch failed for ${dept.name}:`, errMsg);
        await logEvent("failed", `No agents available for ${dept.name}: ${errMsg}`, dept.id);
        await supabase.from("tasks").update({ status: "failed" }).eq("id", task.id);
        failedDepts.push({ name: dept.name, error: errMsg });
        continue;
      }

      console.log(`[forge-pm] Found ${agents.length} agents for ${dept.name}`);

      // ── Create task_outputs for each agent ─────────────────────

      console.log(`[forge-pm] Step 3c: Creating task_outputs for ${dept.name}`);
      let outputFailures = 0;
      for (const agent of agents) {
        const { error: outputError } = await supabase.from("task_outputs").insert({
          task_id: task.id,
          agent_id: agent.id,
          agent_name: agent.name,
          agent_role: agent.role,
          status: "pending",
        });

        if (outputError) {
          outputFailures++;
          console.error(
            `[forge-pm] Failed to create output for agent ${agent.name}:`,
            formatSupabaseError(outputError)
          );
          await logEvent(
            "failed",
            `Failed to create output for ${agent.name}: ${formatSupabaseError(outputError)}`,
            dept.id
          );
        }
      }

      console.log(`[forge-pm] Outputs created for ${dept.name}: ${agents.length - outputFailures}/${agents.length} OK`);
      await logEvent("started", `${dept.name}: ${agents.length} agent outputs created`, dept.id);

      // ── Create project_department entry ────────────────────────

      console.log(`[forge-pm] Step 3d: Creating project_department for ${dept.name}`);
      const { data: pd, error: pdError } = await supabase
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

      if (pdError) {
        console.error(
          `[forge-pm] Failed to create project_department for ${dept.name}:`,
          formatSupabaseError(pdError)
        );
        await logEvent(
          "failed",
          `Failed to link ${dept.name} to project: ${formatSupabaseError(pdError)}`,
          dept.id
        );
        failedDepts.push({ name: dept.name, error: formatSupabaseError(pdError) });
        continue;
      }

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

    console.log(
      `[forge-pm] Phase 3 complete: ${projectDepts.length} departments OK, ${failedDepts.length} failed`
    );

    // ── Phase 4: Process each department's agents ─────────────────

    console.log("[forge-pm] Step 4: Processing department agents");
    const allOutputs: Array<{ department: string; role: string; agent: string; content: string }> = [];

    for (const pd of projectDepts) {
      console.log(`[forge-pm] Processing agents for ${pd.deptName} (${pd.agents.length} agents)`);

      for (const agent of pd.agents) {
        console.log(`[forge-pm] AI generation starting for ${agent.name} (${agent.role})`);
        await logEvent("started", `${pd.deptName} — ${agent.name} (${agent.role}) generating...`, pd.deptId);

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
              const errText = await response.text();
              console.error(
                `[forge-pm] OpenAI error for ${agent.role} in ${pd.deptName}: ${response.status} — ${errText.slice(0, 200)}`
              );
              content = generateFallback(agent.role, pd.subGoal);
            } else {
              const json = await response.json();
              const raw = json.choices?.[0]?.message?.content?.trim();
              content = raw && raw.length > 20 ? raw : generateFallback(agent.role, pd.subGoal);
            }
          } catch (fetchErr) {
            console.error(`[forge-pm] OpenAI fetch failed for ${agent.role}:`, fetchErr);
            content = generateFallback(agent.role, pd.subGoal);
          }
        } else {
          console.log(`[forge-pm] No OpenAI key — using fallback for ${agent.role}`);
          content = generateFallback(agent.role, pd.subGoal);
        }

        // Update task_output
        console.log(`[forge-pm] Updating task_output for ${agent.name}`);
        const { error: updateError } = await supabase
          .from("task_outputs")
          .update({
            status: "completed",
            content,
            completed_at: new Date().toISOString(),
          })
          .eq("task_id", pd.taskId)
          .eq("agent_id", agent.id);

        if (updateError) {
          console.error(
            `[forge-pm] Failed to update output for ${agent.name}:`,
            formatSupabaseError(updateError)
          );
          await logEvent(
            "failed",
            `Failed to save ${agent.name}'s output: ${formatSupabaseError(updateError)}`,
            pd.deptId
          );
        } else {
          console.log(`[forge-pm] AI generation completed for ${agent.name}`);
          await logEvent("completed", `${pd.deptName} — ${agent.name} completed`, pd.deptId);
        }

        allOutputs.push({
          department: pd.deptName,
          role: agent.role,
          agent: agent.name,
          content,
        });
      }

      // Mark task and project_department as completed
      console.log(`[forge-pm] Marking task ${pd.taskId} as completed`);
      await supabase
        .from("tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", pd.taskId);

      await supabase
        .from("project_departments")
        .update({ status: "completed" })
        .eq("id", pd.pdId);

      await logEvent("completed", `${pd.deptName} completed all outputs`, pd.deptId);
      console.log(`[forge-pm] ${pd.deptName} fully completed`);
    }

    // ── Phase 5: Executive Summary (only if at least one department succeeded) ──

    console.log(
      `[forge-pm] Phase 4 complete: ${projectDepts.length} departments processed, ${failedDepts.length} failures`
    );

    if (projectDepts.length === 0) {
      // No departments completed — mark project as failed
      console.error("[forge-pm] ZERO departments completed successfully. Marking project as failed.");
      const failureSummary = failedDepts.map((f) => `${f.name}: ${f.error}`).join("; ");
      await logEvent("failed", `No department tasks completed successfully. Failures: ${failureSummary}`);
      await supabase.from("projects").update({ status: "failed" }).eq("id", projectId);

      return new Response(
        JSON.stringify({
          success: false,
          error: "No department tasks completed successfully",
          failures: failedDepts,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // At least one department succeeded — generate the executive report
    console.log("[forge-pm] Step 5: Generating Executive Summary");
    await logEvent("summary", `Generating executive project report from ${projectDepts.length} departments...`);

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
        console.error("[forge-pm] Summary generation failed:", err);
      }
    }

    if (!summaryContent) {
      // Fallback summary — only for departments that actually succeeded
      const deptList = projectDepts.map((p) => p.deptName).join(", ");
      summaryContent = `## Business Summary\nProject completed successfully across ${projectDepts.length} department(s): ${deptList}. Each department delivered structured, actionable outputs tailored to the goal.\n\n## Department Contributions\n${deptContributions.map((dc) => `- **${dc.department}:** ${dc.summary.slice(0, 120)}`).join("\n")}\n\n## Recommendations\n1. Review department outputs in detail\n2. Prioritize actions based on impact vs. effort\n3. Schedule cross-functional alignment meeting\n\n## Next Steps\n1. **Immediate:** Review the full report and share with stakeholders\n2. **Short-term:** Implement top-priority recommendations\n3. **Medium-term:** Track metrics and iterate`;
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

    // If some departments failed, include that in the final event
    if (failedDepts.length > 0) {
      await logEvent(
        "summary",
        `Executive report ready. ${projectDepts.length} department(s) completed, ${failedDepts.length} failed: ${failedDepts.map((f) => f.name).join(", ")}`
      );
    } else {
      await logEvent("summary", "Executive project report ready — all departments completed successfully");
    }

    console.log("[forge-pm] COMPLETE — Project finished successfully");

    return new Response(
      JSON.stringify({
        success: true,
        projectId,
        completedDepartments: projectDepts.length,
        failedDepartments: failedDepts.length,
        failures: failedDepts.length > 0 ? failedDepts : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[forge-pm] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
