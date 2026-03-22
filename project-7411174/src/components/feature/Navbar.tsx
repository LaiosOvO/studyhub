import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../base/DropdownMenu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../base/Tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "../base/Popover";
import { Badge } from "../base/Badge";

interface NavbarProps {
  transparent?: boolean;
}

export default function Navbar({ transparent = false }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/search", label: "论文搜索", icon: "ri-search-line" },
    { href: "/scholars", label: "学者库", icon: "ri-user-star-line" },
    { href: "/research", label: "研究历史", icon: "ri-history-line" },
    { href: "/research/demo", label: "论文地图", icon: "ri-mind-map" },
    { href: "/agent", label: "AI 技能", icon: "ri-robot-line" },
    { href: "/autoresearch", label: "AutoResearch", icon: "ri-loop-left-line" },
    { href: "/plans", label: "方案", icon: "ri-draft-line" },
    { href: "/community", label: "社区", icon: "ri-team-line" },
  ];

  const notifications: { id: number; icon: string; color: string; text: string; time: string; unread: boolean }[] = [];

  const unreadCount = 0;
  const { isLoggedIn, user, logout } = useAuth();
  const navigate = useNavigate();
  const isScrolledOrNotTransparent = scrolled || !transparent;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolledOrNotTransparent ? "bg-[#080C1A]/90 backdrop-blur-md border-b border-white/[0.06]" : "bg-transparent"
      }`}
      style={{ height: "68px" }}
    >
      <div className="max-w-[1400px] mx-auto px-6 h-full flex items-center justify-between gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 flex-shrink-0 cursor-pointer">
          <img
            src="https://public.readdy.ai/ai/img_res/5e93819c-221e-4458-9a44-d75391e76e7a.png"
            alt="StudyHub Logo"
            className="h-8 w-auto"
          />
          <span className="font-bold text-lg text-[#F1F5F9] tracking-tight">
            Study<span className="text-[#00D4B8]">Hub</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href || location.pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                to={link.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "text-[#00D4B8] bg-[#00D4B8]/10"
                    : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.05]"
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className={`${link.icon} text-sm`} />
                </span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5">
          {/* Language Switch */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.05] transition-all cursor-pointer whitespace-nowrap">
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-global-line" />
                </span>
                中文
              </button>
            </TooltipTrigger>
            <TooltipContent>切换语言</TooltipContent>
          </Tooltip>

          {isLoggedIn ? (
            <>
              {/* Notification Bell — Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.05] transition-all cursor-pointer">
                    <i className="ri-notification-3-line text-base" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center leading-none">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#F1F5F9]">通知</span>
                      {unreadCount > 0 && (
                        <Badge variant="red" className="text-[10px] px-1.5 py-0">{unreadCount} 条未读</Badge>
                      )}
                    </div>
                    <button className="text-xs text-[#00D4B8] hover:underline cursor-pointer whitespace-nowrap">全部已读</button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-[#475569]">
                        <i className="ri-notification-off-line text-2xl mb-2" />
                        <span className="text-xs">暂无通知</span>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer ${n.unread ? "bg-[#00D4B8]/[0.03]" : ""}`}
                        >
                          <span className={`w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5 ${n.color}`}>
                            <i className={`${n.icon} text-sm`} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#F1F5F9] leading-relaxed">{n.text}</p>
                            <p className="text-[10px] text-[#475569] mt-1">{n.time}</p>
                          </div>
                          {n.unread && <div className="w-1.5 h-1.5 rounded-full bg-[#00D4B8] flex-shrink-0 mt-1.5" />}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2.5 border-t border-white/[0.06]">
                    <button className="w-full text-center text-xs text-[#94A3B8] hover:text-[#00D4B8] transition-colors cursor-pointer">
                      查看所有通知
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* User Menu — DropdownMenu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg hover:bg-white/[0.05] transition-all cursor-pointer outline-none">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00D4B8] to-[#00A896] flex items-center justify-center text-[#080C1A] text-xs font-bold flex-shrink-0">
                      R
                    </div>
                    <span className="text-sm text-[#94A3B8] hidden sm:block">我的账户</span>
                    <span className="w-3 h-3 flex items-center justify-center">
                      <i className="ri-arrow-down-s-line text-xs text-[#475569]" />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile/me" className="flex items-center gap-2">
                      <span className="w-4 h-4 flex items-center justify-center"><i className="ri-user-line text-sm" /></span>
                      我的档案
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/research" className="flex items-center gap-2">
                      <span className="w-4 h-4 flex items-center justify-center"><i className="ri-history-line text-sm" /></span>
                      我的任务
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/reading-lists" className="flex items-center gap-2">
                      <span className="w-4 h-4 flex items-center justify-center"><i className="ri-bookmark-line text-sm" /></span>
                      阅读列表
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/scholars?tab=following" className="flex items-center gap-2">
                      <span className="w-4 h-4 flex items-center justify-center"><i className="ri-user-follow-line text-sm" /></span>
                      关注学者
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2">
                      <span className="w-4 h-4 flex items-center justify-center"><i className="ri-settings-3-line text-sm" /></span>
                      设置
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-400 focus:text-red-400 focus:bg-red-400/[0.06] flex items-center gap-2"
                    onSelect={async () => { await logout(); navigate("/login"); }}
                  >
                    <span className="w-4 h-4 flex items-center justify-center"><i className="ri-logout-circle-line text-sm" /></span>
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.05] transition-all cursor-pointer whitespace-nowrap">
                登录
              </Link>
              <Link to="/register" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-[#00D4B8] text-[#080C1A] hover:bg-[#00A896] transition-all duration-200 cursor-pointer whitespace-nowrap">
                免费开始
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
