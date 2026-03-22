import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/feature/Navbar";
import Footer from "../../components/feature/Footer";
import { type Plan } from "../../mocks/experiments";
import { plansApi, experimentsApi, type PlanResponse } from "../../lib/api";
import EmptyState from "../../components/base/EmptyState";
import PlanCard from "./components/PlanCard";
import PlanDetail from "./components/PlanDetail";

interface LocalPlan {
  id: string;
  title: string;
  researchQuestion: string;
  methodology: string;
  innovation: string;
  expectedContribution: string;
  difficulty: string;
  difficultyReason: string;
  estimatedTime: string;
  datasets: string[];
  direction: string;
  createdAt: string;
  status: "draft";
}

/** Map API response to the Plan shape used by UI components. */
function toPlan(r: PlanResponse): Plan {
  return {
    id: r.id,
    name: r.title,
    targetPaper: "",
    hypothesis: r.hypothesis ?? "",
    method: r.methodology ?? "",
    baselineMethod: "",
    expectedImprovement: "",
    feasibilityScore: r.feasibility_score ?? 0,
    feasibilityBreakdown: [],
    status: (r.status as Plan["status"]) ?? "draft",
    metrics: [],
    datasets: [],
    steps: [],
    codeSketch: "",
    createdAt: r.created_at,
  };
}

/** Map local plan to the Plan shape. */
function localToPlan(lp: LocalPlan): Plan {
  const difficultyScore = lp.difficulty === "低" ? 90 : lp.difficulty === "中" ? 70 : 50;
  return {
    id: lp.id,
    name: lp.title,
    targetPaper: lp.direction,
    hypothesis: lp.researchQuestion,
    method: lp.methodology,
    baselineMethod: "",
    expectedImprovement: lp.expectedContribution,
    feasibilityScore: difficultyScore,
    feasibilityBreakdown: [
      { label: "创新性", score: 85 },
      { label: "可行性", score: difficultyScore },
    ],
    status: "draft",
    metrics: [],
    datasets: lp.datasets.map(d => ({ name: d, size: "—", url: "" })),
    steps: [lp.methodology],
    codeSketch: "",
    createdAt: lp.createdAt,
  };
}

/**
 * Plans page — orchestrates PlanCard list + PlanDetail panel.
 * All heavy rendering is delegated to sub-components.
 */
export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Load local plans from localStorage
    let localPlans: Plan[] = [];
    try {
      const stored: LocalPlan[] = JSON.parse(localStorage.getItem("studyhub_local_plans") || "[]");
      localPlans = stored.map(localToPlan);
    } catch { /* ignore */ }

    plansApi
      .list()
      .then((data) => {
        if (cancelled) return;
        const apiPlans = data.map(toPlan);
        const allPlans = [...localPlans, ...apiPlans];
        setPlans(allPlans);
        setSelectedPlan(allPlans[0] ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        // Backend may be unreachable, still show local plans
        if (localPlans.length > 0) {
          setPlans(localPlans);
          setSelectedPlan(localPlans[0] ?? null);
        } else {
          setError("加载方案失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleRunPlan = async (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    // Save plan context for AutoResearch to pick up
    const planContext = {
      planId: plan.id,
      name: plan.name,
      targetPaper: plan.targetPaper,
      hypothesis: plan.hypothesis,
      method: plan.method,
      baselineMethod: plan.baselineMethod,
      expectedImprovement: plan.expectedImprovement,
      metrics: plan.metrics,
      datasets: plan.datasets,
      steps: plan.steps,
      codeSketch: plan.codeSketch,
    };
    localStorage.setItem("studyhub_pending_plan", JSON.stringify(planContext));

    // Build a rich goal string from plan data
    const goal = [
      plan.name,
      plan.hypothesis ? `假设: ${plan.hypothesis}` : "",
      plan.method ? `方法: ${plan.method}` : "",
      plan.expectedImprovement ? `预期: ${plan.expectedImprovement}` : "",
    ].filter(Boolean).join("\n");

    // Local plans don't exist in backend DB — go straight to AutoResearch
    if (planId.startsWith("local_")) {
      navigate(`/autoresearch?goal=${encodeURIComponent(goal)}`);
      return;
    }

    try {
      // Server plan — create experiment via API with full context
      await experimentsApi.create({
        plan_id: planId,
        max_rounds: 50,
        goal,
        hypothesis: plan.hypothesis,
        method: plan.method,
        expected_improvement: plan.expectedImprovement,
        baseline_method: plan.baselineMethod,
        datasets: plan.datasets?.map((d) => d.name) ?? [],
      });
      setPlans((prev) => prev.map((p) =>
        p.id === planId ? { ...p, status: "running" as const } : p
      ));
      setSelectedPlan((prev) => prev?.id === planId ? { ...prev, status: "running" as const } : prev);
      navigate(`/experiments`);
    } catch {
      // API unavailable — navigate to AutoResearch with full context
      navigate(`/autoresearch?goal=${encodeURIComponent(goal)}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#080C1A]">
      <Navbar />

      <main id="main-content" className="max-w-[1400px] mx-auto px-6 pt-24 pb-16">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#F1F5F9] mb-1">实验方案</h1>
            <p className="text-[#94A3B8] text-sm">AI 生成的实验改进方案，选择并执行</p>
          </div>
          <button
            onClick={() => navigate("/agent/new")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00D4B8] text-[#080C1A] text-sm font-semibold hover:bg-[#00A896] transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line" />
            生成新方案
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <i className="ri-loader-4-line animate-spin text-2xl text-[#00D4B8] mr-3" />
            <span className="text-[#94A3B8]">加载方案中…</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-center">
            <p className="text-red-400 mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-[#00D4B8] hover:underline cursor-pointer"
            >
              重试
            </button>
          </div>
        )}

        {/* Main content */}
        {!loading && !error && (
        <div className="flex gap-6">
          {/* Left sidebar — plan list */}
          <aside className="w-72 flex-shrink-0 space-y-3" aria-label="方案列表">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isActive={selectedPlan?.id === plan.id}
                onSelect={setSelectedPlan}
              />
            ))}

            {/* Create from research */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate("/research/new")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/research/new")}
              className="rounded-xl p-6 border border-dashed border-white/[0.1] text-center cursor-pointer hover:border-[#00D4B8]/20 transition-all group bg-white/[0.01]"
            >
              <span className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] mx-auto mb-3 group-hover:bg-[#00D4B8]/10 transition-all">
                <i className="ri-add-line text-[#475569] group-hover:text-[#00D4B8]" />
              </span>
              <p className="text-xs text-[#475569] group-hover:text-[#00D4B8] transition-colors">从深度研究生成新方案</p>
            </div>
          </aside>

          {/* Right — detail or empty state */}
          {selectedPlan ? (
            <PlanDetail
              plan={selectedPlan}
              onClose={() => setSelectedPlan(null)}
              onRun={(planId) => handleRunPlan(planId)}
            />
          ) : (
            <div className="flex-1 bg-[#0E1428] rounded-2xl border border-dashed border-white/[0.1] flex items-center justify-center">
              <EmptyState
                icon="ri-draft-line"
                title="选择一个方案查看详情"
                description="从左侧选择方案，或从深度研究结果中生成新方案"
                actionLabel="开始深度研究"
                onAction={() => navigate("/research/new")}
                actionIcon="ri-rocket-line"
                secondaryLabel="随机选择"
                onSecondary={() => setSelectedPlan(plans[0] ?? null)}
              />
            </div>
          )}
        </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
