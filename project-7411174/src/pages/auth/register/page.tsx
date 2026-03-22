import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { authApi } from "../../../lib/api";

type Step = "credentials" | "academic" | "papers" | "done";

const ROLE_OPTIONS = [
  { value: "undergraduate", label: "本科生" },
  { value: "master", label: "硕士研究生" },
  { value: "phd", label: "博士研究生" },
  { value: "postdoc", label: "博士后" },
  { value: "professor", label: "教授/副教授" },
  { value: "researcher", label: "研究员" },
  { value: "other", label: "其他" },
];

export default function RegisterPage() {
  // Step state
  const [step, setStep] = useState<Step>("credentials");

  // Credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // Academic info
  const [institution, setInstitution] = useState("");
  const [major, setMajor] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [role, setRole] = useState("");
  const [directions, setDirections] = useState("");

  // Paper upload
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { register } = useAuth();

  // ── Validation ────────────────────────────────────────────────────────────
  const validateCredentials = () => {
    if (!inviteCode.trim()) return "请输入内测码";
    if (!displayName.trim()) return "请输入显示名称";
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return "请输入有效的邮箱地址";
    if (password.length < 8) return "密码至少 8 位";
    if (password !== confirmPassword) return "两次输入的密码不一致";
    return "";
  };

  const validateAcademic = () => {
    if (!role) return "请选择身份";
    return "";
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleNextToAcademic = () => {
    const err = validateCredentials();
    if (err) { setError(err); return; }
    setError("");
    setStep("academic");
  };

  const handleNextToPapers = () => {
    const err = validateAcademic();
    if (err) { setError(err); return; }
    setError("");
    setStep("papers");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ["pdf", "md", "txt", "markdown"].includes(ext || "");
    });
    setUploadedFiles((prev) => [...prev, ...valid]);
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const directionsList = directions
        .split(/[,，、;\n]/)
        .map((d) => d.trim())
        .filter(Boolean);

      await register(email, password, displayName, {
        invite_code: inviteCode,
        institution: institution || undefined,
        major: major || undefined,
        advisor: advisor || undefined,
        role: role || undefined,
        research_directions: directionsList.length > 0 ? directionsList : undefined,
      });

      // Upload papers if any (post-registration, user is now logged in)
      if (uploadedFiles.length > 0) {
        try {
          const result = await authApi.uploadPapers(uploadedFiles);
          if (result.extracted_keywords?.length > 0) {
            setExtractedKeywords(result.extracted_keywords);
            setStep("done");
            return; // Show keywords before navigating
          }
        } catch {
          // Non-fatal: registration succeeded, paper upload failed
        }
      }

      navigate("/");
    } catch (ex: unknown) {
      const msg = ex instanceof Error ? ex.message : "注册失败";
      setError(msg);
      // If invite code error, go back to first step
      if (msg.includes("内测码")) {
        setStep("credentials");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Password strength ─────────────────────────────────────────────────────
  const getPasswordStrength = () => {
    if (password.length === 0) return { width: "0%", color: "", label: "" };
    if (password.length < 8) return { width: "25%", color: "bg-red-500", label: "弱" };
    if (password.length < 12) return { width: "60%", color: "bg-amber-400", label: "中" };
    return { width: "100%", color: "bg-accent-green", label: "强" };
  };
  const strength = getPasswordStrength();

  // ── Step indicator ────────────────────────────────────────────────────────
  const steps: { key: Step; label: string; num: number }[] = [
    { key: "credentials", label: "账号信息", num: 1 },
    { key: "academic", label: "学术身份", num: 2 },
    { key: "papers", label: "论文上传", num: 3 },
  ];
  const currentIdx = step === "done" ? steps.length : steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute top-1/4 right-1/3 w-80 h-80 bg-accent-cyan/[0.04] rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md py-10">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-3 cursor-pointer">
            <img src="https://public.readdy.ai/ai/img_res/5e93819c-221e-4458-9a44-d75391e76e7a.png" alt="StudyHub" className="h-10 w-auto" />
            <span className="font-bold text-xl text-text-primary">Study<span className="text-gradient-cyan">Hub</span></span>
          </Link>
          <p className="text-text-muted text-sm mt-2">开启你的 AI 科研之旅</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 mb-6 max-w-xs mx-auto">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  i === currentIdx ? "border-accent-cyan bg-accent-cyan text-bg-primary" :
                  i < currentIdx ? "border-accent-cyan bg-accent-cyan/20 text-accent-cyan" :
                  "border-white/[0.15] text-text-muted"
                }`}>{s.num}</div>
                <span className={`text-[10px] whitespace-nowrap ${i === currentIdx ? "text-accent-cyan" : "text-text-muted"}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-10 mx-1.5 mb-4 transition-all ${
                  i < currentIdx ? "bg-accent-cyan" : "bg-white/[0.1]"
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-8 border border-white/[0.08]">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5">
              <i className="ri-error-warning-line" />
              {error}
            </div>
          )}

          {/* ── Step 1: Credentials ── */}
          {step === "credentials" && (
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-text-primary mb-2">创建账户</h1>

              {/* Invite Code */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2" htmlFor="inviteCode">
                  内测码 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted">
                    <i className="ri-key-line text-sm" />
                  </span>
                  <input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="请输入内测邀请码"
                    className="w-full pl-9 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2" htmlFor="displayName">显示名称</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted">
                    <i className="ri-user-line text-sm" />
                  </span>
                  <input
                    id="displayName" type="text" value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="如：张三 / Zhang San"
                    className="w-full pl-9 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2" htmlFor="reg-email">邮箱地址</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted">
                    <i className="ri-mail-line text-sm" />
                  </span>
                  <input
                    id="reg-email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-9 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2" htmlFor="reg-password">密码</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted">
                    <i className="ri-lock-line text-sm" />
                  </span>
                  <input
                    id="reg-password" type={showPwd ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 8 位"
                    className="w-full pl-9 pr-10 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 transition-colors"
                    required
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-secondary cursor-pointer">
                    <i className={showPwd ? "ri-eye-off-line text-sm" : "ri-eye-line text-sm"} />
                  </button>
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                      <span>密码强度</span>
                      <span className={strength.color.replace("bg-", "text-")}>{strength.label}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.08]">
                      <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2" htmlFor="confirmPassword">确认密码</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted">
                    <i className="ri-lock-2-line text-sm" />
                  </span>
                  <input
                    id="confirmPassword" type="password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                    className={`w-full pl-9 pr-4 py-3 bg-white/[0.04] border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none transition-colors ${
                      confirmPassword && confirmPassword !== password
                        ? "border-red-500/50 focus:border-red-500/70"
                        : "border-white/[0.08] focus:border-accent-cyan/50"
                    }`}
                    required
                  />
                  {confirmPassword && confirmPassword === password && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-accent-green">
                      <i className="ri-check-line text-sm" />
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handleNextToAcademic}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-accent-cyan text-bg-primary hover:bg-accent-cyan-dim transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
              >
                下一步 <i className="ri-arrow-right-line" />
              </button>
            </div>
          )}

          {/* ── Step 2: Academic Info ── */}
          {step === "academic" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setStep("credentials")} className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/[0.08] text-text-muted hover:text-text-primary cursor-pointer transition-colors">
                  <i className="ri-arrow-left-s-line text-sm" />
                </button>
                <h1 className="text-xl font-bold text-text-primary">学术身份</h1>
              </div>
              <p className="text-xs text-text-muted -mt-2 mb-2">帮助我们更好地理解你的研究领域，提供精准推荐</p>

              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">
                  身份 <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRole(opt.value)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
                        role === opt.value
                          ? "bg-accent-cyan/10 border-accent-cyan/40 text-accent-cyan"
                          : "bg-white/[0.03] border-white/[0.08] text-text-muted hover:border-white/[0.15]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Institution */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">院校/机构</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted">
                    <i className="ri-building-line text-sm" />
                  </span>
                  <input
                    type="text" value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="如：清华大学 / Tsinghua University"
                    className="w-full pl-9 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 transition-colors"
                  />
                </div>
              </div>

              {/* Major */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">专业/方向</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted">
                    <i className="ri-book-2-line text-sm" />
                  </span>
                  <input
                    type="text" value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="如：计算机科学与技术"
                    className="w-full pl-9 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 transition-colors"
                  />
                </div>
              </div>

              {/* Advisor */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">导师</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-muted">
                    <i className="ri-user-star-line text-sm" />
                  </span>
                  <input
                    type="text" value={advisor}
                    onChange={(e) => setAdvisor(e.target.value)}
                    placeholder="导师姓名（可选）"
                    className="w-full pl-9 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 transition-colors"
                  />
                </div>
              </div>

              {/* Research Directions */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">研究方向</label>
                <textarea
                  value={directions}
                  onChange={(e) => setDirections(e.target.value)}
                  placeholder="输入研究方向，用逗号分隔&#10;如：自然语言处理, 大语言模型, 医疗AI"
                  rows={2}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-cyan/50 transition-colors"
                />
              </div>

              <button
                onClick={handleNextToPapers}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-accent-cyan text-bg-primary hover:bg-accent-cyan-dim transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
              >
                下一步 <i className="ri-arrow-right-line" />
              </button>
            </div>
          )}

          {/* ── Step 3: Paper Upload ── */}
          {step === "papers" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setStep("academic")} className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/[0.08] text-text-muted hover:text-text-primary cursor-pointer transition-colors">
                  <i className="ri-arrow-left-s-line text-sm" />
                </button>
                <h1 className="text-xl font-bold text-text-primary">上传论文</h1>
              </div>
              <p className="text-xs text-text-muted -mt-2 mb-2">
                上传你的论文，AI 将自动解析你的研究领域（可选，注册后也可上传）
              </p>

              {/* Upload area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/[0.12] rounded-xl p-8 text-center cursor-pointer hover:border-accent-cyan/30 hover:bg-accent-cyan/[0.03] transition-all"
              >
                <i className="ri-upload-cloud-2-line text-3xl text-text-muted mb-2" />
                <p className="text-sm text-text-secondary">点击上传论文文件</p>
                <p className="text-xs text-text-muted mt-1">支持 PDF、Markdown 格式，单文件最大 20MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.md,.txt,.markdown"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* File list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <i className={`${file.name.endsWith(".pdf") ? "ri-file-pdf-2-line text-red-400" : "ri-markdown-line text-accent-cyan"} text-lg`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-primary truncate">{file.name}</p>
                        <p className="text-[10px] text-text-muted">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(i)}
                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-400/10 text-text-muted hover:text-red-400 cursor-pointer transition-colors"
                      >
                        <i className="ri-close-line text-sm" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold bg-accent-cyan text-bg-primary hover:bg-accent-cyan-dim transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {loading ? (
                    <><i className="ri-loader-4-line animate-spin" /> 创建账户中...</>
                  ) : uploadedFiles.length > 0 ? "完成注册" : "跳过，直接注册"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Done (keywords preview) ── */}
          {step === "done" && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-accent-green/10 flex items-center justify-center">
                <i className="ri-check-double-line text-2xl text-accent-green" />
              </div>
              <h1 className="text-xl font-bold text-text-primary">注册成功</h1>
              <p className="text-sm text-text-muted">AI 已从你的论文中提取了以下研究方向：</p>

              <div className="p-4 rounded-xl bg-accent-cyan/[0.05] border border-accent-cyan/20 text-left">
                <div className="flex flex-wrap gap-2">
                  {extractedKeywords.map((kw) => (
                    <span key={kw} className="text-xs px-3 py-1 rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-xs text-text-muted">这些方向已自动添加到你的研究档案中</p>

              <button
                onClick={() => navigate("/")}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-accent-cyan text-bg-primary hover:bg-accent-cyan-dim transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                进入 StudyHub <i className="ri-arrow-right-line" />
              </button>
            </div>
          )}

          {/* Login link */}
          <div className="mt-5 pt-5 border-t border-white/[0.06] text-center">
            <p className="text-sm text-text-muted">
              已有账号？{" "}
              <Link to="/login" className="text-accent-cyan hover:underline cursor-pointer font-medium">
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
