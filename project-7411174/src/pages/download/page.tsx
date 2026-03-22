/**
 * Download page for StudyHub desktop app.
 */

import Navbar from "../../components/feature/Navbar";

const BASE_URL = "http://101.126.141.165/studyhub/downloads";

const RELEASES = [
  {
    platform: "macOS",
    icon: "ri-apple-fill",
    arch: "Apple Silicon (M1/M2/M3/M4)",
    filename: "StudyHub_0.2.0_aarch64.dmg",
    url: `${BASE_URL}/StudyHub_0.2.0_aarch64.dmg`,
    size: "~10 MB",
  },
  {
    platform: "macOS",
    icon: "ri-apple-fill",
    arch: "Intel",
    filename: "StudyHub_0.2.0_x64.dmg",
    url: `${BASE_URL}/StudyHub_0.2.0_x64.dmg`,
    size: "~10 MB",
  },
  {
    platform: "Windows",
    icon: "ri-windows-fill",
    arch: "64-bit",
    filename: "StudyHub_0.2.0_x64-setup.exe",
    url: `${BASE_URL}/StudyHub_0.2.0_x64-setup.exe`,
    size: "~8 MB",
  },
];

const FEATURES = [
  { icon: "ri-loop-left-line", title: "AutoResearch", desc: "自动研究循环 — 假设 → 实验 → 评估 → 迭代" },
  { icon: "ri-tools-line", title: "240+ AI 技能", desc: "内置 LabClaw 研究技能库，涵盖文献、统计、可视化" },
  { icon: "ri-gpu-line", title: "GPU 监控", desc: "实时 GPU 利用率、温度、显存监控" },
  { icon: "ri-folder-open-line", title: "工作区管理", desc: "项目文件管理、实验日志、论文输出" },
  { icon: "ri-flask-line", title: "实验引擎", desc: "自动训练循环，keep/discard 决策" },
  { icon: "ri-file-paper-2-line", title: "论文辅助", desc: "从实验到论文的全流程支持" },
];

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <div className="pt-24 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent-cyan/30 bg-accent-cyan/[0.08] mb-4">
              <i className="ri-download-2-line text-accent-cyan" />
              <span className="text-xs font-medium text-accent-cyan">Desktop App</span>
            </div>
            <h1 className="text-4xl font-bold text-text-primary mb-4">StudyHub Desktop</h1>
            <p className="text-lg text-text-secondary max-w-xl mx-auto">
              自动研究引擎 + 240 AI 技能 + GPU 实验管理，一个桌面端搞定
            </p>
          </div>

          {/* Download Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
            {RELEASES.map((r) => (
              <a
                key={r.filename}
                href={r.url}
                className="group p-6 rounded-2xl glass border border-white/[0.06] hover:border-accent-cyan/30 transition-all text-center"
              >
                <i className={`${r.icon} text-3xl text-text-primary mb-3 block`} />
                <h3 className="text-sm font-bold text-text-primary mb-1">{r.platform}</h3>
                <p className="text-[10px] text-text-muted mb-4">{r.arch}</p>
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-cyan text-bg-primary text-xs font-bold group-hover:opacity-90 transition-opacity">
                  <i className="ri-download-line" />
                  下载 {r.size}
                </div>
                <p className="text-[10px] text-text-muted mt-2">{r.filename}</p>
              </a>
            ))}
          </div>

          {/* Features */}
          <h2 className="text-xl font-bold text-text-primary text-center mb-8">桌面端专属功能</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-accent-cyan/10 mb-3">
                  <i className={`${f.icon} text-accent-cyan text-lg`} />
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">{f.title}</h3>
                <p className="text-xs text-text-secondary">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* macOS Install Note */}
          <div className="mt-12 p-6 rounded-2xl bg-amber-500/[0.08] border border-amber-500/20">
            <h3 className="text-sm font-semibold text-amber-400 mb-3">
              <i className="ri-error-warning-line mr-1" />
              macOS 安装提示
            </h3>
            <p className="text-xs text-text-secondary mb-2">
              由于应用未签名，macOS 可能提示"已损坏"或"无法验证开发者"。请在终端执行以下命令后重新打开：
            </p>
            <code className="block p-3 rounded-lg bg-black/30 text-xs text-accent-cyan font-mono">
              xattr -cr /Applications/StudyHub.app
            </code>
            <p className="text-[10px] text-text-muted mt-2">
              或者：系统设置 → 隐私与安全性 → 点击"仍然打开"
            </p>
          </div>

          {/* System Requirements */}
          <div className="mt-6 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-sm font-semibold text-text-primary mb-3">系统要求</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-text-secondary">
              <div>
                <p className="font-medium text-text-primary mb-1">macOS</p>
                <p>macOS 11 (Big Sur) 或更高版本</p>
                <p>Apple Silicon 或 Intel 处理器</p>
              </div>
              <div>
                <p className="font-medium text-text-primary mb-1">Windows</p>
                <p>Windows 10 (1803) 或更高版本</p>
                <p>x86_64 处理器</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
