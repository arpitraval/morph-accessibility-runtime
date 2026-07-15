# MORPH

### *Any interface. Any body. One intent.*

MORPH is a user-controlled accessibility runtime that converts hostile, broken, or inaccessible web interfaces into task-specific adaptive surfaces. It operates the original interface one bounded step at a time and verifies fresh evidence after every action.

MORPH changes the unit of web interaction from painful page navigation to verified human intent. **It is not a generic chat wrapper, an accessibility overlay, or a simple WCAG conformance claim.**

---

## 🚀 Submission Links

* **Live Application:** `<LIVE_APP_URL>`
* **Chaotic Demo Portal:** `<LIVE_DEMO_PORTAL_URL>`
* **3-Minute Demo Video:** `<DEMO_VIDEO_URL>`
* **Source Repository:** `<REPOSITORY_URL>`
* **Track:** Apps for Your Life

---

## ⚡ The 5-Second Proof (How to Judge)

The application opens in a **Split-Screen Developer Shell**:

* **The Left Side:** An intentionally chaotic travel booking portal running shifting layouts, hidden fees, and broken inputs.
* **The Right Side:** The MORPH shell, which dynamically compiles the messy site into a beautiful, ultra-accessible interaction surface based on the user's profile.

**The Magic Trick:** Click **"Mutate source UI"** on the left pane. The underlying website's code will instantly scramble. Watch the live **Agent Observatory** at the bottom: MORPH instantly catches the layout shift, rejects the stale data, rewinds the state, and safely recompiles a fresh, working interface without losing the user's budget or consent constraints.

---

## 🌍 The Human Impact (Why We Built MORPH)

According to the World Health Organization, **1.3 billion people** live with a significant disability today. Yet, the internet is still fundamentally hostile to them.

Currently, accessibility relies on a flawed premise: waiting for millions of individual companies to manually fix their code, or forcing users to buy clunky, outdated screen readers that break when websites update.

**MORPH flips the power dynamic.**

Instead of waiting for the world to become accessible, MORPH acts as a protective shield at the user's edge. Whether a user has low vision, limited motor control (One-Switch), or requires reduced cognitive load, MORPH empowers them to forcefully adapt the web to their own body and intent in real-time. We are moving from a world where users adapt to technology, to a world where technology dynamically adapts to the human.

---

## 🛠️ The 2026 OpenAI Tech Stack (Key Architecture)

MORPH is built using deterministic safety code combined with the absolute cutting edge of the OpenAI ecosystem:

* **Reasoning Plane (`gpt-5.6-sol`):** Core multi-agent logic calls `client.responses.create` with `reasoning: { effort: "high" }` for deep cognitive execution.
* **Programmatic Tool Calling:** Features the new `programmatic_tool_calling` hosted tool. The DOM tree never enters the prompt as an unbounded text dump; it is strictly fetched via V8-isolated, Zod-validated tool structures.
* **Codex Adapter Forge (`@openai/codex-sdk`):** When a target website mutates so drastically that standard routing fails, a server-side Codex specialist spins up in a secure, network-disabled ephemeral sandbox to generate, test, and sign a brand-new TypeScript adapter on the fly to repair the pipeline.
* **Durable Execution Ledger:** A PostgreSQL + `pgvector` append-only database logs the exact state cycle (`CAPTURE → NORMALIZE → ROUTE → PARALLEL_REASON → COMPILE → SIMULATE → RISK_GATE → EXECUTE_ONE_STEP → VERIFY`) streamed live to the UI via Server-Sent Events (SSE).

---

## 🎨 Material Access Profiles

One single JSON layout manifest dynamically compiles into three radically different, semantic React experiences:

* **Low Vision:** 200% scalable typography, high-contrast dark theme, massive click targets, and reduced motion.
* **One-Switch Motor:** Deterministic focus order, 72-pixel minimum targets, and automatic sequential keyboard scanning.
* **Cognitive Load Reduction:** Plain language conversion, aggressive whitespace, and a maximum of three choices visible at any single time.

---

## 🏁 Judge-Safe Local Testing (Replay Mode)

To allow flawless testing without needing live database seeds or live billing keys, the repository is packaged with a **Zero-Secret Deterministic Fallback** that replicates the exact multi-agent execution stream.

### 1. Setup

`git clone <REPOSITORY_URL>`

`cd morph`

`npm ci`

`npx playwright install chromium`

### 2. Configure Environment

Create a file named `.env.local` in the root folder and paste these stable testing flags (no API keys required for replay mode):

`MORPH_DEMO_MODE=replay`

`NEXT_PUBLIC_MORPH_OBSERVATORY_MODE=replay`

`MORPH_MULTI_AGENT_ENABLED=false`

`CODEX_ADAPTER_FORGE_ENABLED=false`

`MORPH_REQUIRE_CONSENT=true`

`MORPH_MAX_REPLANS=3`

### 3. Run the Evaluation Suite

Verify the 30-case matrix and the safety engine build invariants:

`npm run check`

### 4. Launch the Split-Screen Demo

Open two separate terminal windows:

* **Terminal 1 (The Broken Portal):** `npm run dev:portal` (Runs on `http://127.0.0.1:4173`)
* **Terminal 2 (MORPH Runtime Shell):** `npm run dev` (Runs on `http://127.0.0.1:3000`)

Open **`http://127.0.0.1:3000`** in your browser to interact with the full system.
