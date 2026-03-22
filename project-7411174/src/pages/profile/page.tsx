import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/feature/Navbar";
import Footer from "../../components/feature/Footer";
import { profilesApi, researchApi, type ProfileResponse, type DeepResearchTask } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwner = userId === "me" || userId === user?.id;

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [tasks, setTasks] = useState<DeepResearchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const p = isOwner
          ? await profilesApi.getMe()
          : await profilesApi.getPublic(userId!);
        setProfile(p);
      } catch {
        if (isOwner) {
          setNoProfile(true);
        } else {
          setError("找不到该用户的资料");
        }
      }
    };

    const loadTasks = async () => {
      if (!isOwner) return;
      try {
        const t = await researchApi.list({ limit: 5 });
        const sorted = [...t].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setTasks(sorted);
      } catch {
        // Non-critical
      }
    };

    Promise.all([loadProfile(), loadTasks()]).finally(() => setLoading(false));
  }, [userId, isOwner]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="flex items-center justify-center pt-40">
          <i className="ri-loader-4-line animate-spin text-3xl text-accent-cyan" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-40 gap-4">
          <i className="ri-user-unfollow-line text-4xl text-text-muted" />
          <p className="text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  // No profile — prompt creation
  if (noProfile) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-40 gap-4 max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center">
            <i className="ri-user-add-line text-2xl text-accent-cyan" />
          </div>
          <h2 className="text-xl font-bold text-text-primary">创建你的研究者资料</h2>
          <p className="text-sm text-text-muted">
            创建资料后可以使用社区匹配、合作推荐等功能。
          </p>
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-cyan text-bg-primary text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <i className="ri-arrow-right-line" />
            前往设置创建资料
          </button>
        </div>
      </div>
    );
  }

  const displayName = profile?.name || user?.name || "用户";
  const initial = displayName[0]?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <div className="max-w-[1000px] mx-auto px-6 pt-24 pb-16">
        <div className="flex gap-8">
          {/* Main */}
          <main className="flex-1">
            {/* Profile Header */}
            <div className="glass rounded-2xl p-8 border border-white/[0.06] mb-6">
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-cyan to-accent-cyan-dim flex items-center justify-center text-2xl font-bold text-bg-primary flex-shrink-0">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-text-primary mb-1">{displayName}</h1>
                  <p className="text-text-secondary text-sm">
                    {[profile?.title, profile?.institution].filter(Boolean).join(" · ") || "暂未填写"}
                  </p>
                  {profile?.bio && (
                    <p className="text-text-muted text-sm mt-3 leading-relaxed max-w-xl">{profile.bio}</p>
                  )}
                </div>
                {isOwner && (
                  <button
                    onClick={() => navigate("/settings")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/[0.1] text-xs text-text-secondary hover:border-white/[0.2] hover:text-text-primary cursor-pointer whitespace-nowrap flex-shrink-0"
                  >
                    <i className="ri-edit-line" /> 编辑资料
                  </button>
                )}
              </div>
            </div>

            {/* Research Directions */}
            {profile?.research_directions && profile.research_directions.length > 0 && (
              <div className="glass rounded-xl p-5 border border-white/[0.06] mb-5">
                <h3 className="text-sm font-semibold text-text-primary mb-3">研究方向</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.research_directions.map((d) => (
                    <span key={d} className="px-3 py-1.5 rounded-full text-xs bg-accent-cyan/[0.08] border border-accent-cyan/20 text-accent-cyan">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Expertise */}
            {profile?.expertise && profile.expertise.length > 0 && (
              <div className="glass rounded-xl p-5 border border-white/[0.06] mb-5">
                <h3 className="text-sm font-semibold text-text-primary mb-3">专业技能</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.expertise.map((e) => (
                    <span key={e} className="px-3 py-1.5 rounded-full text-xs bg-white/[0.04] border border-white/[0.08] text-text-secondary">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Research Tasks (owner only) */}
            {isOwner && tasks.length > 0 && (
              <div className="glass rounded-xl border border-white/[0.06]">
                <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-primary">最近研究任务</h3>
                  <button
                    onClick={() => navigate("/research")}
                    className="text-xs text-accent-cyan hover:underline"
                  >
                    查看全部
                  </button>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => navigate(t.status === "completed" ? `/research/${t.id}` : "/research")}
                      className="w-full text-left px-5 py-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{t.research_direction}</p>
                          <p className="text-xs text-text-muted mt-1">
                            {t.papers_found} 篇论文 · {new Date(t.created_at).toLocaleDateString("zh-CN")}
                          </p>
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state if no content */}
            {!profile?.research_directions?.length && !profile?.expertise?.length && tasks.length === 0 && (
              <div className="glass rounded-xl p-8 border border-white/[0.06] text-center">
                <i className="ri-file-list-line text-3xl text-text-muted mb-3" />
                <p className="text-sm text-text-muted">资料还比较空，去设置中完善你的研究者资料吧</p>
                <button
                  onClick={() => navigate("/settings")}
                  className="mt-3 text-xs text-accent-cyan hover:underline"
                >
                  前往设置
                </button>
              </div>
            )}
          </main>

          {/* Sidebar Stats */}
          <aside className="w-48 flex-shrink-0 space-y-4">
            {[
              { icon: "ri-bar-chart-grouped-line", label: "H 指数", value: profile?.h_index ?? "—", color: "text-accent-cyan" },
              { icon: "ri-git-branch-line", label: "总引用数", value: profile?.citation_count != null ? profile.citation_count.toLocaleString() : "—", color: "text-amber-400" },
              { icon: "ri-article-line", label: "发表论文", value: profile?.paper_count ?? "—", color: "text-green-400" },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-xl p-5 border border-white/[0.06] text-center">
                <span className={`w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] mx-auto mb-2 ${stat.color}`}>
                  <i className={`${stat.icon} text-base`} />
                </span>
                <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-text-muted mt-1">{stat.label}</div>
              </div>
            ))}
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "等待中", cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
    running: { label: "进行中", cls: "text-accent-cyan bg-accent-cyan/10 border-accent-cyan/20" },
    completed: { label: "已完成", cls: "text-green-400 bg-green-400/10 border-green-400/20" },
    failed: { label: "失败", cls: "text-red-400 bg-red-400/10 border-red-400/20" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}
