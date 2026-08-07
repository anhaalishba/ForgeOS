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

// ─── Per-role system prompts ───────────────────────────────────────────

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

IMPORTANT: Do NOT regurgitate the goal text as filler. Invent realistic, domain-specific details. If the goal mentions a fitness app, talk about user acquisition, retention cohorts, LTV, and churn. If it mentions a SaaS product, talk about MRR, CAC, and NPS. Be the expert.`,

  Strategy:
    `You are a senior strategist in a corporate AI workflow platform called ForgeOS. You produce **Go-to-Market Strategy Briefs** that marketing VPs and product leaders actually use to make decisions.

Your response MUST use Markdown formatting and include these sections:

## Market Opportunity
A specific, quantified assessment of the opportunity. Mention real trends, TAM/SAM/SOM if relevant, and competitor dynamics. Use the actual domain from the goal.

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

IMPORTANT: Be genuinely analytical. Invent plausible competitor names, realistic personas, and domain-appropriate metrics. Do not use placeholder text or repeat the goal.`,

  Analyst:
    `You are a senior data analyst in a corporate AI workflow platform called ForgeOS. You produce **Data Analysis Reports** that are grounded, specific, and actionable.

Your response MUST use Markdown formatting and include these sections:

## Data Summary
What data you analyzed (invent realistic datasets relevant to the goal), sample size, and time period.

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

IMPORTANT: Use realistic numbers, mention specific metric names (CAC, LTV, NPS, churn, DAU/MAU, conversion rate, etc.), and avoid vague statements. If the goal is about a fitness app, segment users by activity level, talk about retention by week, and estimate cohort LTV.`,

  Creative:
    `You are a creative director in a corporate AI workflow platform called ForgeOS. You produce **Creative Briefs** with genuinely creative, original ideas — not fill-in-the-blank templates.

Your response MUST use Markdown formatting and include these sections:

## Creative Concept
A named concept with a one-liner tagline and a paragraph explaining the big idea. The concept should be specific to the product/initiative in the goal.

## Headline Options
- **Option A:** A bold, specific headline
- **Option B:** An emotional/aspirational headline
- **Option C:** A clever/punny headline (where appropriate)

## Visual Direction
Describe a visual style — color palette mood, photography style, typography feel. Be specific (e.g., "warm amber and deep teal, kinetic typography, candid athlete photography" rather than "modern and clean").

## Messaging Pillars
| Pillar | Key Message | Proof Point |
|--------|-------------|-------------|
| ... | ... | ... |

## Content Formats
3 specific content ideas (social campaigns, blog series, video concepts, interactive experiences) with enough detail to brief a team.

IMPORTANT: Be genuinely creative. Invent campaign names, write real headlines, describe visual direction with specificity. Do not say "vibrant" or "cutting-edge" without defining them.`,

  Engineering:
    `You are a senior engineer / technical architect in a corporate AI workflow platform called ForgeOS. You produce **Technical Specifications** that an engineering team can actually build from.

Your response MUST use Markdown formatting and include these sections:

## Architecture Overview
A 2–3 sentence description of the recommended architecture. Mention specific patterns (microservices, event-driven, serverless, monorepo) and justify the choice based on the goal.

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
Numbered phases with estimated effort (in story points or days).

## Technical Risks
The 2 biggest technical risks and mitigation approaches.

IMPORTANT: Be specific about technologies, versions, and patterns. If the goal mentions a fitness app, design a real mobile + backend architecture with realistic choices. Use current tech (2024+). Do not be vague.`,
};

// ─── Fallback templates (used when OpenAI is unavailable) ─────────────

const FALLBACK_TEMPLATES: Record<string, string[]> = {
  "Lead": [
    `## Executive Summary
The initiative presents a significant opportunity to drive measurable impact through focused execution and cross-functional alignment.

## Key Priorities
- **Priority 1:** Establish clear success metrics and reporting cadence within the first sprint
- **Priority 2:** Align stakeholders across departments with a RACI matrix and weekly sync
- **Priority 3:** Identify and mitigate the top 3 risks before scaling investment

## Success Metrics
| Metric | Target | Timeline |
|--------|--------|----------|
| North Star metric | +15% improvement | Q2 |
| Leading indicator | Baseline established | Week 2 |
| Cost efficiency | Within 10% of budget | Ongoing |

## Recommendation
Launch with a 2-week pilot, measure rigorously, and decide on full investment based on data — not intuition.`,
  ],
  "Strategy": [
    `## Market Opportunity
The addressable market is evolving rapidly, with incumbents showing vulnerability in user experience and new entrants driving innovation at the low end.

## Target Audience
- **Primary persona:** The "efficiency seeker" — values speed, clear ROI, and minimal learning curve. Currently underserved by existing solutions.
- **Secondary persona:** The "early adopter" — wants the newest approach, willing to tolerate rough edges for competitive advantage.

## Competitive Positioning
| Competitor | Strength | Weakness | Our Advantage |
|------------|----------|----------|---------------|
| Market Leader | Brand trust | Slow innovation | Speed to market |
| Disruptor X | Modern UX | Limited features | Full-feature parity |
| Legacy Option | Enterprise deals | Technical debt | Modern stack |

## Channel Strategy
1. **Content-led growth** — highest ROI for B2B consideration
2. **Product Hunt / community launch** — credibility and early adopters
3. **Outbound to mid-market** — personalized demos for 50–200 seat companies

## Risk Assessment
- **Adoption risk:** Mitigate with freemium tier and 30-day onboarding support
- **Competitive response:** Move fast on the feature differentiators that are hardest to copy`,
  ],
  "Analyst": [
    `## Data Summary
Analysis of user behavior data across 12 weeks (n=45,000 users) segmented by engagement level, acquisition channel, and feature adoption.

## Key Findings
| Insight | Impact | Confidence |
|---------|--------|------------|
| Power users (top 10%) drive 60% of total value | High | High |
| Organic acquisition has 3.2x better retention than paid | High | High |
| Feature discovery drop-off at day 7 is the largest leak | High | Medium |

## Metric Deep-Dive
- **7-day retention:** 34% (benchmark: 28%) — above average, but day-7 cliff suggests onboarding gap
- **Feature adoption rate:** 22% of users try >3 features — upsell opportunity at the 3-feature threshold
- **Churn predictor:** Users who don't invite a teammate within 48 hours churn at 4x the rate

## Recommendations
1. Redesign onboarding to drive a collaborative action within the first session
2. Build a "power user" nurture track with advanced feature discovery
3. Shift 20% of paid acquisition budget to content/SEO based on retention data

## Data Limitations
- Segmentation excludes users with <1 session (bounce traffic)
- Attribution windows are 7-day click, 1-day view — may undercount brand influence`,
  ],
  "Creative": [
    `## Creative Concept
**"Unlock Your Rhythm"** — A campaign that positions the product not as a tool but as the key to finding your natural workflow. Visuals contrast chaotic, fragmented work life with the calm focus the product enables.

## Headline Options
- **Option A:** "Stop fighting your tools. Start finding your flow."
- **Option B:** "The 10 minutes that save you 10 hours."
- **Option C:** "Work doesn't have to feel like work."

## Visual Direction
Warm neutrals (stone, sand, clay) with a single vibrant accent (electric blue). Photography: candid, shallow depth-of-field shots of real people in real workspaces — no stock-photo perfection. Typography: generous whitespace, one serif headline font paired with a clean geometric sans-serif for body.

## Messaging Pillars
| Pillar | Key Message | Proof Point |
|--------|-------------|-------------|
| Speed | Get more done in less time | Average user saves 8 hrs/week |
| Clarity | One place for everything | 94% reduction in tool-switching |
| Control | You set the rules | Customizable workflows, no coding |

## Content Formats
1. **"Flow State" video series** — 5× 90-second documentary-style profiles of real users
2. **Interactive ROI calculator** — embeddable tool showing time/cost savings
3. **Weekly productivity newsletter** — curated tips with product tie-ins, not overt ads`,
  ],
  "Engineering": [
    `## Architecture Overview
A serverless-first architecture with event-driven communication between bounded contexts. This provides cost efficiency at low scale, automatic horizontal scaling, and clean domain boundaries that enable independent team velocity.

## Tech Stack Recommendation
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 19 + TypeScript | Ecosystem maturity, hiring pool |
| Backend | Node.js + Fastify | Performance, TypeScript alignment |
| Database | PostgreSQL (managed) | Reliability, full-text search, JSONB |
| Infrastructure | AWS via SST | Infrastructure-as-code, serverless |

## API Design
\`\`\`
POST /api/v1/submissions
Authorization: Bearer <token>
{
  "goal": "string",
  "department_id": "uuid",
  "agents": ["uuid"]
}
→ 201 { "task_id": "uuid", "status": "processing" }
\`\`\`

## Data Model
- **tasks** (id, goal, department_id, status, created_at, completed_at)
- **task_outputs** (id, task_id, agent_id, status, content, completed_at)
- **agents** (id, name, role, department_id, avatar_letter)

## Implementation Plan
1. **Sprint 1 (2 weeks):** Core task submission, agent pipeline, output persistence
2. **Sprint 2 (1.5 weeks):** Real-time updates via WebSocket, UI polish
3. **Sprint 3 (1 week):** Error handling, retry logic, monitoring dashboards

## Technical Risks
- **LLM latency:** Use streaming responses and optimistic UI to feel instant
- **Concurrency limits:** Queue tasks and process with backpressure; set user expectations`,
  ],
  "default": [
    `## Summary
Analysis complete. Below are the structured findings.

## Key Points
- Primary finding with supporting context
- Secondary insight with actionable implication
- Risk or consideration worth noting

## Next Steps
1. Review the recommendations with stakeholders
2. Prioritize based on impact vs. effort
3. Schedule follow-up within 2 weeks to track progress`,
  ],
};

function generateFallback(role: string, goal: string): string {
  const templates = FALLBACK_TEMPLATES[role] || FALLBACK_TEMPLATES["default"];
  const template = templates[Math.floor(Math.random() * templates.length)];
  // Insert the goal into a contextual spot if present, otherwise just return the template
  return template.replace(
    "The initiative",
    `**${goal}**`
  );
}

function buildSystemPrompt(agent: AgentInput): string {
  // Use role-specific prompt if available, otherwise a generic one
  if (ROLE_SYSTEM_PROMPTS[agent.role]) {
    return ROLE_SYSTEM_PROMPTS[agent.role];
  }

  // Generic prompt for unknown roles — still much better than before
  return `You are ${agent.name}, a ${agent.role} in a corporate AI workflow platform called ForgeOS. You produce professional, well-structured outputs using Markdown formatting.

Your response MUST use Markdown and include clear sections with ## headings, bullet points, and a table where appropriate. Be specific — invent realistic details relevant to the goal. Do not repeat the goal text as filler. Write at least 150 words of genuinely useful content.`;
}

function buildUserPrompt(agent: AgentInput, goal: string): string {
  return `Goal: "${goal}"

You are the **${agent.role}** (${agent.name}). Produce your complete output for this goal now. Follow your system instructions exactly — include all required sections, use proper Markdown formatting, and fill in every section with specific, thoughtful content. Do not use placeholder text, lorem ipsum, or generic filler. Write as if you are delivering real work to a paying client.`;
}

// ─── Main handler ──────────────────────────────────────────────────────

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

    for (const agent of agents) {
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
                { role: "user", content: buildUserPrompt(agent, goal) },
              ],
              max_tokens: 800,
              temperature: 0.8,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            console.error(`OpenAI error for agent ${agent.id} (${agent.role}): ${response.status} — ${errText.slice(0, 200)}`);
            content = generateFallback(agent.role, goal);
          } else {
            const json = await response.json();
            const raw = json.choices?.[0]?.message?.content?.trim();
            if (raw && raw.length > 20) {
              content = raw;
            } else {
              console.warn(`OpenAI returned short/empty output for ${agent.role}, using fallback`);
              content = generateFallback(agent.role, goal);
            }
          }
        } catch (fetchErr) {
          console.error(`OpenAI fetch failed for ${agent.role}:`, fetchErr);
          content = generateFallback(agent.role, goal);
        }
      } else {
        content = generateFallback(agent.role, goal);
        console.log(`No OPENAI_API_KEY set — using fallback for ${agent.role}`);
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

    // Mark the task as completed
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
