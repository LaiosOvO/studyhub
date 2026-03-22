import { BrowserRouter, HashRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { ToastProvider } from "./components/base/Toast";
import { TooltipProvider } from "./components/base/Tooltip";
import { AuthProvider } from "./contexts/AuthContext";

const isTauri = "__TAURI_INTERNALS__" in window;

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <ToastProvider>
          <TooltipProvider delayDuration={300}>
            {children}
          </TooltipProvider>
        </ToastProvider>
      </AuthProvider>
    </I18nextProvider>
  );
}

function App() {
  const content = (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#00D4B8] focus:text-[#080C1A] focus:rounded-lg focus:font-semibold focus:text-sm focus:shadow-lg"
      >
        跳到主要内容
      </a>
      <AppRoutes />
    </>
  );

  return (
    <AppShell>
      {isTauri ? (
        <HashRouter>{content}</HashRouter>
      ) : (
        <BrowserRouter basename={__BASE_PATH__}>{content}</BrowserRouter>
      )}
    </AppShell>
  );
}

export default App;
