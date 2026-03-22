import type { RouteObject } from "react-router-dom";
import AuthRequired from "../components/base/AuthRequired";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import SearchPage from "../pages/search/page";
import PaperDetailPage from "../pages/papers/page";
import LoginPage from "../pages/auth/login/page";
import RegisterPage from "../pages/auth/register/page";
import ResearchPage from "../pages/research/page";
import ResearchReportPage from "../pages/research/report/page";
import MapPage from "../pages/research/map/page";
import WorkspacePage from "../pages/research/workspace/page";
import PlansPage from "../pages/plans/page";
import ExperimentsPage from "../pages/experiments/page";
import CommunityPage from "../pages/community/page";
import ReadingListsPage from "../pages/reading-lists/page";
import ScholarsPage from "../pages/scholars/page";
import ProfilePage from "../pages/profile/page";
import AgentPage from "../pages/agent/page";
import AutoResearchPage from "../pages/autoresearch/page";
import ResearchHistoryPage from "../pages/research/history/page";
import TaskDetailPage from "../pages/research/task/page";
import SettingsPage from "../pages/settings/page";
import DownloadPage from "../pages/download/page";

/** Wrap a page element with auth check — shows login prompt if not authenticated */
function auth(element: React.ReactNode) {
  return <AuthRequired>{element}</AuthRequired>;
}

const routes: RouteObject[] = [
  // Public routes
  { path: "/", element: <Home /> },
  { path: "/search", element: <SearchPage /> },
  { path: "/papers/:paperId", element: <PaperDetailPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/scholars", element: <ScholarsPage /> },

  // Auth-required routes
  { path: "/research", element: auth(<ResearchHistoryPage />) },
  { path: "/research/new", element: auth(<ResearchPage />) },
  { path: "/research/:taskId/detail", element: auth(<TaskDetailPage />) },
  { path: "/research/:taskId", element: auth(<MapPage />) },
  { path: "/research/:taskId/report", element: auth(<ResearchReportPage />) },
  { path: "/research/:taskId/workspace", element: auth(<WorkspacePage />) },
  { path: "/plans", element: auth(<PlansPage />) },
  { path: "/experiments", element: auth(<ExperimentsPage />) },
  { path: "/community", element: auth(<CommunityPage />) },
  { path: "/reading-lists", element: auth(<ReadingListsPage />) },
  { path: "/profile/:userId", element: auth(<ProfilePage />) },
  { path: "/settings", element: auth(<SettingsPage />) },

  // Agent routes
  { path: "/agent", element: auth(<AgentPage />) },
  { path: "/agent/new", element: auth(<AgentPage />) },
  { path: "/autoresearch", element: auth(<AutoResearchPage />) },

  // Public
  { path: "/download", element: <DownloadPage /> },

  { path: "*", element: <NotFound /> },
];

export default routes;
