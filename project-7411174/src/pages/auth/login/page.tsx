import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const validate = () => {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return "请输入有效的邮箱地址";
    if (password.length < 8) return "密码至少 8 位";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (ex: unknown) {
      const msg = ex instanceof Error ? ex.message : "登录失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-accent-cyan/[0.04] rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 cursor-pointer">
            <img src="https://public.readdy.ai/ai/img_res/5e93819c-221e-4458-9a44-d75391e76e7a.png" alt="StudyHub" className="h-10 w-auto" />
            <span className="font-bold text-xl text-text-primary">Study<span className="text-gradient-cyan">Hub</span></span>
          </Link>
          <p className="text-text-muted text-sm mt-2">登录继续你的研究之旅</p>
        </div>

        <div className="glass rounded-2xl p-8 border border-white/[0.08]">
          <h1 className="text-xl font-bold text-text-primary mb-6">欢迎回来</h1>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5">
              <i className="ri-error-warning-line" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2" htmlFor="email">邮箱地址</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted">
                  <i className="ri-mail-line text-sm" />
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-9 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2" htmlFor="password">密码</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted">
                  <i className="ri-lock-line text-sm" />
                </span>
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-secondary cursor-pointer"
                >
                  <i className={showPwd ? "ri-eye-off-line text-sm" : "ri-eye-line text-sm"} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded accent-[#00D4B8] cursor-pointer" />
                <span className="text-xs text-text-secondary">记住我</span>
              </label>
              <button type="button" className="text-xs text-accent-cyan hover:underline cursor-pointer">忘记密码？</button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-accent-cyan text-bg-primary hover:bg-accent-cyan-dim transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <><i className="ri-loader-4-line animate-spin" /> 登录中...</>
              ) : "登录"}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-white/[0.06] text-center">
            <p className="text-sm text-text-muted">
              还没有账号？{" "}
              <Link to="/register" className="text-accent-cyan hover:underline cursor-pointer font-medium">
                立即注册
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
