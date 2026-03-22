import { Link } from "react-router-dom";

export default function Footer() {
  const links = {
    产品: [
      { label: "论文搜索", href: "/search" },
      { label: "论文地图", href: "/research/demo" },
      { label: "AI 实验", href: "/experiments" },
      { label: "学者社区", href: "/community" },
    ],
    资源: [
      { label: "API 文档", href: "#" },
      { label: "使用教程", href: "#" },
      { label: "研究案例", href: "#" },
      { label: "更新日志", href: "#" },
    ],
    关于: [
      { label: "关于我们", href: "#" },
      { label: "联系我们", href: "#" },
      { label: "隐私政策", href: "#" },
      { label: "服务条款", href: "#" },
    ],
  };

  return (
    <footer className="border-t border-white/[0.06] bg-bg-secondary">
      <div className="max-w-[1400px] mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-4 cursor-pointer">
              <img
                src="https://public.readdy.ai/ai/img_res/5e93819c-221e-4458-9a44-d75391e76e7a.png"
                alt="StudyHub"
                className="h-8 w-auto"
              />
              <span className="font-bold text-lg text-text-primary">
                Study<span className="text-gradient-cyan">Hub</span>
              </span>
            </Link>
            <p className="text-text-secondary text-sm leading-relaxed max-w-xs mb-6">
              AI 驱动的学术研究平台。从论文到实验，全程加速你的科研之路。
            </p>
            <div className="flex items-center gap-3">
              {["ri-twitter-x-line", "ri-github-line", "ri-linkedin-box-line", "ri-wechat-line"].map((icon) => (
                <a
                  key={icon}
                  href="#"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.05] text-text-secondary hover:text-text-primary hover:bg-accent-cyan/10 hover:text-accent-cyan transition-all cursor-pointer"
                >
                  <i className={`${icon} text-sm`} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-text-primary font-semibold text-sm mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.href}
                      className="text-text-secondary text-sm hover:text-accent-cyan transition-colors cursor-pointer"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-xs">
            © 2026 StudyHub. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-text-muted text-xs">
            <span>Powered by</span>
            <span className="text-accent-cyan font-medium ml-1">AI Research Engine</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
