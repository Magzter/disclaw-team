import {
  isRouteErrorResponse,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { useState, useEffect } from "react";
import { useNavigation } from "react-router";
import { ToastProvider } from "./components/Toast";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

const navItems = [
  { to: "/", label: "Dashboard", icon: "◉" },
  { to: "/teams", label: "Teams", icon: "⚙" },
  { to: "/roles", label: "Roles", icon: "★" },
  { to: "/schedules", label: "Schedules", icon: "⏱" },
  { to: "/settings", label: "Settings", icon: "☰" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>disclaw-team — Deploy AI teams to Discord</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function RestartBanner() {
  const [needsRestart, setNeedsRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await fetch("/api/status");
        if (!active) return;
        const data = await res.json();
        setNeedsRestart(data.needsRestart);
      } catch {}
    };
    check();
    const interval = setInterval(check, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [navigation.state]);

  if (!needsRestart || restarting) {
    if (restarting) {
      return (
        <div className="bg-[var(--color-accent)]/10 border-b border-[var(--color-accent)]/30 px-4 py-2.5 flex items-center justify-center gap-2">
          <span className="text-xs text-[var(--color-accent)]">Restarting...</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between">
      <span className="text-xs text-amber-400">Team configuration has changed — bots are running with outdated roles.</span>
      <form method="post" action="/api/action" onSubmit={() => setRestarting(true)}>
        <input type="hidden" name="action" value="restart" />
        <button type="submit" className="px-3 py-1 text-xs font-medium bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 transition-colors">
          Restart All
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav className={`
        fixed inset-y-0 left-0 z-30 w-56 flex-shrink-0
        bg-[var(--color-surface-raised)] border-r border-[var(--color-border)] flex flex-col
        transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:flex
      `}>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">disclaw-team</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Deploy AI teams to Discord.</p>
          </div>
          <button
            className="md:hidden text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-r-2 border-[var(--color-accent)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                }`
              }
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="p-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
          v0.1.0
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 w-full overflow-auto">
        <RestartBanner />
        <div className="p-6">
          {/* Mobile header with hamburger */}
          <div className="flex items-center gap-3 mb-4 md:hidden">
            <button
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              ☰
            </button>
            <span className="text-sm font-medium">disclaw-team</span>
          </div>
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </div>
      </main>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "Page not found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">{message}</h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">{details}</p>
    </main>
  );
}
