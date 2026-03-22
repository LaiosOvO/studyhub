import Navbar from "../../components/feature/Navbar";
import Footer from "../../components/feature/Footer";
import HeroSection from "./components/HeroSection";
import FeatureCards from "./components/FeatureCards";
import { useNavigate } from "react-router-dom";

function HowItWorks() {
  const steps = [
    { step: "01", icon: "ri-search-line", title: "输入研究方向", desc: "选择方向、粘贴论文或用自然语言描述研究兴趣" },
    { step: "02", icon: "ri-global-line", title: "AI 自动检索", desc: "跨库检索全球文献，构建引用关系网络" },
    { step: "03", icon: "ri-map-pin-line", title: "发现研究空白", desc: "AI 分析领域现状，标注未被解决的研究问题" },
    { step: "04", icon: "ri-rocket-line", title: "生成并执行实验", desc: "自动设计实验方案，一键启动 GPU 训练" },
  ];

  return (
    <section className="py-24 px-6 bg-bg-secondary">
      <div className="max-w-[1400px] mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-text-primary mb-4">四步完成完整科研流程</h2>
          <p className="text-text-secondary text-lg">以往需要数月的工作，现在数天内完成</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={step.step} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-full w-full h-px bg-gradient-to-r from-accent-cyan/30 to-transparent z-10" style={{ width: "calc(100% - 2.5rem)", left: "calc(100% - 0px)" }} />
              )}
              <div className="glass rounded-2xl p-6 border border-white/[0.06] hover:border-accent-cyan/20 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-mono font-bold text-accent-cyan opacity-60">{step.step}</span>
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-accent-cyan/10 border border-accent-cyan/20">
                    <i className={`${step.icon} text-base text-accent-cyan`} />
                  </div>
                </div>
                <h3 className="font-semibold text-text-primary mb-2">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  const sources = [
    { name: "arXiv", count: "2.3M+" },
    { name: "Semantic Scholar", count: "200M+" },
    { name: "PubMed", count: "35M+" },
    { name: "OpenAlex", count: "240M+" },
    { name: "CNKI", count: "80M+" },
    { name: "万方数据", count: "30M+" },
  ];

  return (
    <section className="py-20 px-6 max-w-[1400px] mx-auto">
      <div className="text-center mb-12">
        <p className="text-text-muted text-sm mb-6">接入全球顶级学术数据库</p>
        <div className="flex flex-wrap justify-center gap-4">
          {sources.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg glass border border-white/[0.06]"
            >
              <span className="text-sm font-medium text-text-secondary">{s.name}</span>
              <span className="text-xs font-mono text-accent-cyan">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const navigate = useNavigate();
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-glow-radial opacity-40" />
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <h2 className="text-5xl font-bold text-text-primary mb-6">
          准备好加速你的研究了吗？
        </h2>
        <p className="text-xl text-text-secondary mb-10">
          免费注册，立即获取 AI 研究助手、论文地图和实验流水线
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate("/register")}
            className="px-10 py-4 rounded-full text-base font-semibold bg-accent-cyan text-bg-primary hover:bg-accent-cyan-dim transition-all duration-200 cursor-pointer whitespace-nowrap cyan-glow"
          >
            免费开始使用
          </button>
          <button
            onClick={() => navigate("/search")}
            className="px-10 py-4 rounded-full text-base font-semibold border border-white/[0.15] text-text-primary hover:border-accent-cyan/40 hover:bg-accent-cyan/[0.05] transition-all duration-200 cursor-pointer whitespace-nowrap"
          >
            先体验搜索
          </button>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar transparent />
      <main>
        <HeroSection />
        <FeatureCards />
        <HowItWorks />
        <TrustSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
