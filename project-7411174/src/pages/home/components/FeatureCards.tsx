import { useNavigate } from "react-router-dom";

interface Feature {
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  metrics: { label: string; value: string }[];
  cta: string;
  href: string;
  image: string;
}

const features: Feature[] = [
  {
    icon: "ri-mind-map",
    iconBg: "from-accent-cyan/20 to-accent-cyan/5",
    title: "论文地图可视化",
    description: "可视化数千篇论文的引用关系和研究脉络。力导向图谱、主题散点地图、时间线三种视角，让研究全貌一目了然。",
    metrics: [
      { label: "最大节点数", value: "10,000+" },
      { label: "聚类精度", value: "94.2%" },
      { label: "实时更新", value: "24h" },
    ],
    cta: "探索地图",
    href: "/research/demo",
    image: "https://readdy.ai/api/search-image?query=abstract%20network%20graph%20visualization%20with%20glowing%20cyan%20nodes%20and%20connections%20on%20dark%20navy%20background%2C%20scientific%20data%20visualization%2C%20force-directed%20graph%2C%20dots%20and%20lines%20pattern%2C%20deep%20space%20aesthetic%2C%20minimalist%20tech%20art%2C%20high%20contrast%20cyan%20lines%20on%20very%20dark%20background%2C%20no%20text%2C%20pure%20geometric%20abstract&width=600&height=400&seq=feat001&orientation=landscape",
  },
  {
    icon: "ri-flask-line",
    iconBg: "from-accent-amber/20 to-accent-amber/5",
    title: "AI 全自动实验",
    description: "基于文献综述自动生成实验方案，支持一键在本地 GPU 执行。实时监控训练曲线，自动生成实验报告。",
    metrics: [
      { label: "方案生成时间", value: "<30s" },
      { label: "支持框架", value: "PyTorch/JAX" },
      { label: "自动化程度", value: "全流程" },
    ],
    cta: "查看实验",
    href: "/experiments",
    image: "https://readdy.ai/api/search-image?query=futuristic%20laboratory%20automation%20visualization%2C%20glowing%20amber%20and%20teal%20data%20streams%2C%20experiment%20pipeline%20diagram%2C%20abstract%20scientific%20process%20flow%2C%20dark%20background%20with%20illuminated%20nodes%20and%20pathways%2C%20clean%20minimalist%20tech%20aesthetic%2C%20no%20text%2C%20pure%20visual&width=600&height=400&seq=feat002&orientation=landscape",
  },
  {
    icon: "ri-team-line",
    iconBg: "from-accent-green/20 to-accent-green/5",
    title: "跨学科学者匹配",
    description: "AI 分析研究空白与技术需求，从全球学者库中精准匹配互补合作者。支持发布研究需求、站内直接沟通。",
    metrics: [
      { label: "学者数据库", value: "380万+" },
      { label: "匹配准确率", value: "87.5%" },
      { label: "平均响应", value: "48h" },
    ],
    cta: "发现合作者",
    href: "/community",
    image: "https://readdy.ai/api/search-image?query=connected%20researcher%20network%20visualization%2C%20glowing%20green%20teal%20nodes%20representing%20people%20and%20disciplines%2C%20interdisciplinary%20collaboration%20graph%2C%20abstract%20social%20network%20on%20dark%20background%2C%20soft%20light%20halos%20around%20nodes%2C%20minimalist%20geometric%20pattern%2C%20no%20text%20no%20faces&width=600&height=400&seq=feat003&orientation=landscape",
  },
];

export default function FeatureCards() {
  const navigate = useNavigate();

  return (
    <section className="py-24 px-6 max-w-[1400px] mx-auto">
      {/* Section header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] mb-4">
          <span className="text-xs font-medium text-text-secondary">核心功能</span>
        </div>
        <h2 className="text-4xl font-bold text-text-primary mb-4">
          为科研而生的<span className="text-gradient-cyan">三大能力</span>
        </h2>
        <p className="text-text-secondary text-lg max-w-xl mx-auto">
          覆盖从文献调研到实验执行的完整科研流程，让 AI 成为你的全程研究伙伴
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <div
            key={feature.title}
            className="group glass rounded-2xl overflow-hidden border border-white/[0.06] hover:border-accent-cyan/20 transition-all duration-300 cursor-pointer animate-fade-in flex flex-col"
            style={{ animationDelay: `${index * 100}ms` }}
            onClick={() => navigate(feature.href)}
          >
            {/* Image */}
            <div className="relative overflow-hidden" style={{ height: "200px" }}>
              <img
                src={feature.image}
                alt={feature.title}
                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-transparent to-transparent" />
              {/* Icon Badge */}
              <div
                className={`absolute top-4 left-4 w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br ${feature.iconBg} border border-white/[0.1]`}
              >
                <i className={`${feature.icon} text-base text-text-primary`} />
              </div>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col flex-1">
              <h3 className="text-xl font-bold text-text-primary mb-3">{feature.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed mb-5 flex-1">{feature.description}</p>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {feature.metrics.map((metric) => (
                  <div key={metric.label} className="text-center p-2.5 rounded-lg bg-bg-primary/40 border border-white/[0.05]">
                    <div className="text-sm font-bold text-accent-cyan font-mono">{metric.value}</div>
                    <div className="text-[10px] text-text-muted mt-0.5 leading-tight">{metric.label}</div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.08] text-sm font-medium text-text-secondary group-hover:border-accent-cyan/40 group-hover:text-accent-cyan group-hover:bg-accent-cyan/[0.05] transition-all duration-200 cursor-pointer whitespace-nowrap">
                {feature.cta}
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-arrow-right-line text-xs" />
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
