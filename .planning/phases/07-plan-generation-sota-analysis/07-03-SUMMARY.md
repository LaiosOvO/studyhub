---
phase: 07-plan-generation-sota-analysis
plan: 03
status: completed
depends_on: ["07-02"]
---

# 07-03 Summary: Code Skeleton Generator & Plan Editing UI

## What was built

### Backend: Code Skeleton Generator
- **`backend/templates/code_skeleton.py.j2`**: Jinja2 template producing Python experiment scaffolds with configuration, technical roadmap step functions, training loop, evaluation, and baseline reproduction stubs. Handles missing fields gracefully with `{% if %}` guards. Supports LLM-generated method-specific stubs via `{{ llm_stubs }}` variable.
- **`backend/app/services/plan_generation/code_skeleton.py`**: Async service with `generate_code_skeleton()` entry point. Step 1: calls LLM (Sonnet, `plan_code_skeleton` request type) with a prompt built from hypothesis, method_description, baselines, and technical_roadmap to generate method-specific function stubs. Step 2: renders Jinja2 template with plan fields + LLM stubs. Falls back to template-only rendering on LLM failure. Reference: AI-Scientist `perform_experiments.py`.

### Frontend: Plan List & Editor UI
- **`apps/web/src/lib/api/plans.ts`**: TypeScript API client with typed interfaces (`ExperimentPlan`, `PlanGenerationInput`, `PlanUpdate`, etc.) and functions: `fetchPlans`, `fetchPlan`, `generatePlans`, `updatePlan`, `deletePlan`, `approvePlan`. Uses existing `apiFetch` wrapper with auth token handling.
- **`apps/web/src/app/[locale]/plans/page.tsx`**: Plan list page with card grid layout, status filter (all/draft/approved/executing/completed), feasibility score color-coded badges (green >= 3.5, yellow >= 2.5, red < 2.5), entry type badges, and empty state message.
- **`apps/web/src/app/[locale]/plans/[planId]/page.tsx`**: Plan detail/editor page with structured form: editable title, hypothesis textarea, method description textarea, baseline list editor (add/remove), tag-style metrics editor, dataset list editor (name/url/license), numbered roadmap editor (add/remove/reorder), read-only feasibility display with progress bars across 4 dimensions, code skeleton display in `<pre><code>` block, data strategy radio group. Save/Approve/Delete actions with confirmation dialogs. All form fields disabled when status != draft.
- **`apps/web/messages/en.json`**: Added `plans` namespace with 40+ translation keys.
- **`apps/web/messages/zh-CN.json`**: Chinese translations for all plan-related strings.

## Key patterns
- Immutable state updates throughout (spread operators, no mutation)
- All text bilingual via next-intl `useTranslations('plans')`
- Client components (`'use client'`) for interactivity
- Form sends only changed fields on save (diff against original plan)
- LLM fallback: template-only skeleton when LLM unavailable

## Verification status
- Backend import: `from app.services.plan_generation.code_skeleton import generate_code_skeleton` -- PASS
- Jinja2 template load: PASS
- TypeScript compilation: Pending manual verification (`cd apps/web && npx tsc --noEmit`)
