# forgeOS

### Build an AI workforce instead of another chatbot.

**forgeOS** is an AI-native workforce platform that lets companies assemble virtual departments staffed by specialized AI agents.

Instead of asking one generic chatbot to handle everything, forgeOS gives each business function its own AI workforce — with dedicated agents for content, SEO, design, advertising, HR, finance, sales, and more.

For complex goals, the built-in **Project Manager agent** automatically determines which departments are needed, explains why, and coordinates the work across them.

> **Built for the AI Factory — native.builder Hackathon · August 2026**

---

## 🚀 Why forgeOS?

Most AI applications work like this:

```text
User → Chatbot → Answer
```

But real business work looks more like this:

```text
Business Goal
     │
     ▼
Project Manager
     │
     ├── Marketing
     │    ├── Content Writer
     │    ├── SEO Expert
     │    ├── Designer
     │    ├── Ads Manager
     │    └── Analytics Agent
     │
     ├── Sales
     │    ├── Lead Finder
     │    ├── CRM Agent
     │    └── Proposal Writer
     │
     └── Finance
          ├── Accountant
          ├── Auditor
          └── Expense Agent
```

forgeOS turns AI from a **single assistant** into an **AI workforce**.

---

# ✨ Key Features

### 🤖 AI-Native Project Manager

Users can simply describe a business goal without selecting a department.

For example:

> "Launch our product in the UAE."

The Project Manager analyzes the goal and determines which departments are actually required.

It can:

* Analyze the business objective
* Select relevant departments
* Determine the execution order
* Explain its reasoning
* Create department-level tasks
* Route work to specialized AI agents
* Track the resulting outputs

---

### 🏢 AI Departments

forgeOS provides multiple AI-powered business departments.

| Department   | Specialized Agents                                                 |
| ------------ | ------------------------------------------------------------------ |
| 📣 Marketing | Content Writer, SEO Expert, Designer, Ads Manager, Analytics Agent |
| 👥 HR        | Recruiter, Interviewer, Payroll, Policy Assistant                  |
| 💰 Finance   | Accountant, Auditor, Expense Agent                                 |
| 🤝 Sales     | Lead Finder, CRM Agent, Proposal Writer                            |

Each agent has a **dedicated role and system prompt**.

This prevents every agent from producing the same generic response.

---

### 🧠 Specialized AI Agents

Every agent is designed for a specific business function.

For example:

**Content Writer**

Produces:

* Blog drafts
* Social media captions
* Marketing copy
* Content ideas

**SEO Expert**

Produces:

* Keyword strategies
* Search intent analysis
* Content optimization recommendations
* SEO plans

**Designer**

Produces:

* Visual direction
* Color palettes
* Creative concepts
* Design recommendations

**Ads Manager**

Produces:

* Ad copy
* Audience targeting
* Campaign structures
* Advertising strategies

The same principle applies across HR, Finance, and Sales.

---

### ⚡ Live Agent Execution

When a task is submitted, users can watch the workforce execute it.

Agent states move through:

```text
IDLE
  ↓
WORKING
  ↓
COMPLETED
```

Outputs appear in the interface as agents finish their work.

The frontend uses **Supabase Realtime** with polling as a fallback to keep the UI synchronized with backend execution.

---

### 💾 Persistent AI Outputs

forgeOS doesn't rely on temporary chat history.

Tasks and outputs are persisted in PostgreSQL.

This means users can:

* Refresh the page
* Return later
* Review previous projects
* Access completed agent outputs
* Continue working from task history

---

### 📄 Exportable Deliverables

Every completed agent output can be:

* 📋 Copied to clipboard
* 📄 Downloaded as a PDF

This turns AI responses into reusable business deliverables.

---

### 🔐 Secure User Data

forgeOS uses:

* Supabase Authentication
* PostgreSQL
* Row Level Security (RLS)

Each user can only access their own tasks and outputs.

---

# 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│                  React + TypeScript                         │
│                                                             │
│ Dashboard → Departments → Project Manager → Agent Outputs   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         SUPABASE                            │
│                                                             │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │    Auth     │   │  PostgreSQL  │   │ Edge Functions  │  │
│  │             │   │              │   │                 │  │
│  │ User Login  │   │ Tasks        │   │ forge-ai        │  │
│  │             │   │ Agents       │   │ project-manager │  │
│  │             │   │ Outputs      │   │                 │  │
│  └─────────────┘   └──────────────┘   └────────┬────────┘  │
└─────────────────────────────────────────────────┼───────────┘
                                                  │
                                                  ▼
                                      ┌───────────────────────┐
                                      │      AI / LLM API     │
                                      │                       │
                                      │ OpenAI-compatible     │
                                      │ BYOK endpoint         │
                                      └───────────────────────┘
```

---

# 🔄 How It Works

## Project Manager Mode

The AI-native workflow starts with a single business goal.

```text
User
 │
 │ "Launch our product in the UAE"
 ▼
Project Manager
 │
 ├── Analyzes goal
 │
 ├── Selects relevant departments
 │
 └── Explains reasoning
       │
       ▼
┌─────────────────────────────┐
│ Selected Departments        │
│                             │
│ Marketing                   │
│ Sales                       │
│ Finance                     │
└──────────────┬──────────────┘
               │
               ▼
       Department Tasks
               │
               ▼
       Specialized Agents
               │
               ▼
        LLM Generation
               │
               ▼
       Persistent Outputs
               │
               ▼
        Live Dashboard
```

---

## Manual Department Mode

Users can also directly select a department.

```text
User
 │
 ▼
Select Department
 │
 ▼
Enter Goal
 │
 ▼
Create Task
 │
 ▼
Department Agents
 │
 ├── Agent 1
 ├── Agent 2
 ├── Agent 3
 └── Agent 4...
 │
 ▼
LLM Generation
 │
 ▼
Saved Outputs
 │
 ▼
Live Agent Cards
```

---

# 🧩 Agent Architecture

Each agent has its own:

* Name
* Role
* Description
* Avatar
* Department
* Dedicated system prompt

Conceptually:

```text
Agent
 ├── Department
 ├── Role
 ├── Description
 └── System Prompt
          │
          ▼
       LLM API
          │
          ▼
   Role-specific output
```

This is important because forgeOS doesn't simply send the same prompt to multiple AI models.

Instead:

```text
Marketing Goal
      │
      ├── Content Writer → Content deliverable
      │
      ├── SEO Expert → SEO strategy
      │
      ├── Designer → Visual direction
      │
      ├── Ads Manager → Ad campaign
      │
      └── Analytics → Measurement strategy
```

Each agent approaches the same business goal from a different professional perspective.

---

# 🗄️ Database Schema

forgeOS uses Supabase PostgreSQL.

### `departments`

Stores available AI departments.

```text
id
slug
name
description
icon
color
```

### `agents`

Stores specialized AI workforce members.

```text
id
department_id
name
role
description
avatar_letter
system_prompt
```

### `tasks`

Stores department-level work.

```text
id
user_id
department_id
goal
status
created_at
completed_at
project_manager_task_id
```

### `task_outputs`

Stores individual agent deliverables.

```text
id
task_id
agent_id
agent_name
agent_role
content
status
created_at
completed_at
```

### `project_manager_tasks`

Stores Project Manager executions.

```text
id
user_id
goal
departments
reasoning
department_task_ids
status
final_report
created_at
completed_at
```

---

# 🔐 Security

Row Level Security is enabled throughout the application.

The security model ensures:

```text
User A
  │
  └── Can access User A's data

User B
  │
  └── Can access User B's data
```

Users cannot access another user's tasks or generated outputs.

---

# 🛠️ Tech Stack

| Layer                | Technology                  |
| -------------------- | --------------------------- |
| Frontend             | React + TypeScript          |
| Styling              | Tailwind CSS                |
| Routing              | React Router                |
| Icons                | Lucide React                |
| Markdown             | react-markdown + remark-gfm |
| PDF Export           | jsPDF                       |
| Backend              | Supabase                    |
| Database             | PostgreSQL                  |
| Authentication       | Supabase Auth               |
| Security             | Row Level Security          |
| Serverless Functions | Supabase Edge Functions     |
| AI                   | OpenAI-compatible AI/ML API |
| Realtime             | Supabase Realtime           |
| Deployment           | native.builder              |
| Version Control      | GitHub                      |

---

# 📁 Edge Functions

forgeOS uses two main Supabase Edge Functions.

## `forge-ai`

Responsible for executing department-level AI work.

```text
Goal
 │
 ▼
Department
 │
 ▼
Agents
 │
 ▼
Role-specific prompts
 │
 ▼
LLM API
 │
 ▼
Agent outputs
 │
 ▼
Supabase
```

---

## `project-manager`

Responsible for AI-native orchestration.

```text
Business Goal
      │
      ▼
Project Manager LLM
      │
      ├── Relevant departments
      │
      └── Reasoning
              │
              ▼
       Department Tasks
              │
              ▼
           forge-ai
```

---

# 🧪 Example

A user enters:

> **"Launch our new SaaS product in the UAE."**

The Project Manager may determine that the goal requires:

### 📣 Marketing

* UAE-focused content strategy
* SEO opportunities
* Visual campaign direction
* Advertising strategy

### 🤝 Sales

* Ideal customer profile
* Lead generation strategy
* Sales proposal

### 💰 Finance

* Launch budget
* Advertising allocation
* Expense planning

The user doesn't need to manually decide which departments are required.

**forgeOS makes that decision.**

---

# 🎯 What Makes forgeOS Different?

Traditional AI:

```text
Ask → Answer
```

AI tools:

```text
Choose Tool → Enter Prompt → Get Output
```

forgeOS:

```text
Business Goal
      ↓
AI Project Manager
      ↓
Understands the goal
      ↓
Selects departments
      ↓
Coordinates specialized agents
      ↓
Generates real deliverables
      ↓
Stores everything
      ↓
Tracks execution
```

The core idea is simple:

> **Don't build another chatbot. Build an AI workforce.**

---

# 📊 Product Capabilities

| Capability                   | forgeOS |
| ---------------------------- | :-----: |
| Specialized AI agents        |    ✅    |
| AI departments               |    ✅    |
| Automatic department routing |    ✅    |
| Project Manager agent        |    ✅    |
| Visible routing reasoning    |    ✅    |
| Persistent outputs           |    ✅    |
| Live agent status            |    ✅    |
| Task history                 |    ✅    |
| PDF export                   |    ✅    |
| Markdown rendering           |    ✅    |
| Authentication               |    ✅    |
| Row Level Security           |    ✅    |
| Realtime updates             |    ✅    |
| BYOK AI API                  |    ✅    |

---

# 🚀 Getting Started

## Prerequisites

You'll need:

* Node.js
* A Supabase project
* An AI/LLM API key
* A configured frontend environment

---

## 1. Clone the Repository

```bash
git clone <https://github.com/anhaalishba/ForgeOS>
cd forgeOS
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment Variables

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Configure the required AI API credentials in your Supabase Edge Function secrets.

> Never expose private API keys in frontend code.

---

## 4. Configure Supabase

Create your Supabase project and configure:

* Authentication
* PostgreSQL tables
* Row Level Security
* Realtime
* Edge Functions

Seed the departments and agents with their dedicated system prompts.

---

## 5. Run Locally

```bash
npm run dev
```

Then open the local development URL shown by Vite.

---

# 🌐 Deployment

forgeOS was built and deployed using **native.builder**.

The repository is synchronized with GitHub for version control and development.

The production architecture consists of:

```text
React Frontend
      │
      ▼
native.builder
      │
      ▼
Supabase
 ├── Authentication
 ├── PostgreSQL
 ├── Realtime
 └── Edge Functions
       │
       ▼
    AI / LLM API
```

