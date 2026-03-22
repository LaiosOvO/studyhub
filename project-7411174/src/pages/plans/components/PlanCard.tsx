import { Plan } from "../../../mocks/experiments";
import { PLAN_STATUS } from "../../../utils/statusUtils";

interface PlanCardProps {
  plan: Plan;
  isActive: boolean;
  onSelect: (plan: Plan) => void;
}

/**
 * Compact plan card displayed in the left sidebar of the Plans page.
 */
export default function PlanCard({ plan, isActive, onSelect }: PlanCardProps) {
  const st = PLAN_STATUS[plan.status];

  return (
    <div
      onClick={() => onSelect(plan)}
      className={`rounded-xl p-5 border transition-all cursor-pointer group ${
        isActive
          ? "border-[#00D4B8]/30 bg-[#00D4B8]/[0.04]"
          : "border-white/[0.06] bg-[#0E1428] hover:border-[#00D4B8]/20"
      }`}
    >
      {/* Status + feasibility score */}
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.bg} ${st.color}`}>
          {st.label}
        </span>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`w-3 h-3 flex items-center justify-center ${
                i < Math.floor(plan.feasibilityScore / 20) ? "text-amber-400" : "text-white/[0.12]"
              }`}
            >
              <i className="ri-star-fill text-xs" />
            </span>
          ))}
          <span className="text-xs text-[#475569] ml-1 font-mono">{plan.feasibilityScore}%</span>
        </div>
      </div>

      {/* Title */}
      <h3
        className={`text-sm font-semibold mb-2 transition-colors line-clamp-2 ${
          isActive ? "text-[#00D4B8]" : "text-[#F1F5F9] group-hover:text-[#00D4B8]"
        }`}
      >
        {plan.name}
      </h3>

      {/* Target paper */}
      <p className="text-xs text-[#475569] mb-3 line-clamp-1">目标论文：{plan.targetPaper}</p>

      {/* Hypothesis preview */}
      <p className="text-xs text-[#94A3B8] leading-relaxed line-clamp-2 mb-4">{plan.hypothesis}</p>

      {/* Metric tags */}
      <div className="flex flex-wrap gap-1.5">
        {plan.metrics.slice(0, 3).map((m) => (
          <span
            key={m}
            className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[#475569]"
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
