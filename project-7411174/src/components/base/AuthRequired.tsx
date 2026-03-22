import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

interface AuthRequiredProps {
  children: React.ReactNode;
}

/**
 * Wraps page content that requires authentication.
 * Shows a login prompt if the user is not logged in.
 */
export default function AuthRequired({ children }: AuthRequiredProps) {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <i className="ri-loader-4-line text-2xl text-accent-cyan animate-spin" />
          <span className="text-sm text-text-muted">加载中...</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass rounded-2xl border border-white/[0.08] p-10 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-full bg-accent-cyan/10">
            <i className="ri-lock-line text-3xl text-accent-cyan" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">需要登录</h2>
          <p className="text-sm text-text-muted mb-6">
            该功能需要登录后才能使用，请先登录或注册账号。
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/login"
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-accent-cyan text-bg-primary hover:bg-accent-cyan-dim transition-all"
            >
              立即登录
            </Link>
            <Link
              to="/register"
              className="px-6 py-2.5 rounded-xl text-sm font-medium border border-white/[0.1] text-text-secondary hover:text-text-primary hover:border-white/[0.2] transition-all"
            >
              注册账号
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
