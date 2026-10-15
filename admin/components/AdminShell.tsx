"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { api, authReady, isSignedIn, setAccessToken } from "@/lib/api";

type Operator = { name: string; email: string; role: string };

// Every admin screen hangs off this: the sidebar is mounted once by the layout,
// so moving between sections does not re-ask /auth/me or lose the drawer state.
//
// The gate here only decides what to render. It is not the security boundary —
// the backend has to refuse an ordinary user's token on every request, because
// anybody can call the API without this app. What this stops is a signed-in
// seller landing on a staff screen and seeing controls they cannot use.
const AdminShell = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [operator, setOperator] = useState<Operator | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    const leave = async (hadToken: boolean) => {
      if (hadToken) {
        await api.post("/auth/logout").catch(() => {
          // Cookie may already be gone; either way this browser is out.
        });
      }
      setAccessToken(null);
      router.replace("/");
    };

    // The access token lives in memory only, so a hard refresh of /home has no
    // token until AuthBootstrap has traded the refresh cookie for one. Waiting
    // on authReady is what stops that refresh from looking like a sign-out.
    authReady.then(async () => {
      if (!isSignedIn()) {
        router.replace("/");
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        if (data?.user?.role !== "ADMIN") {
          await leave(true);
          return;
        }
        if (alive) setOperator(data.user);
      } catch {
        await leave(false);
      }
    });

    return () => {
      alive = false;
    };
  }, [router]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  const signOut = async () => {
    await api.post("/auth/logout").catch(() => {});
    setAccessToken(null);
    router.replace("/");
  };

  // One blank beat while the role is confirmed. Deliberately empty rather than
  // a spinner: it flashes on every load and says nothing.
  if (!operator) return <div className="min-h-dvh" aria-hidden="true" />;

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* ---------- phone: top bar ---------- */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-panel px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="-ml-1.5 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <p className="font-display text-[17px] leading-none">
          Properties<span className="text-accent">.</span>
        </p>
      </header>

      {/* ---------- phone: off-canvas drawer ---------- */}
      {/* Kept out of the tree when closed so its links are not reachable by
          keyboard behind the page. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeDrawer}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute inset-y-0 left-0 w-[min(82vw,288px)] border-r border-line shadow-xl">
            <Sidebar
              operator={operator}
              onSignOut={signOut}
              onNavigate={closeDrawer}
            />
          </div>
        </div>
      )}

      {/* ---------- desktop: the rail ---------- */}
      {/* sticky + h-dvh, so a long table scrolls under a sidebar that stays. */}
      <aside className="sticky top-0 hidden h-dvh border-r border-line lg:block">
        <Sidebar operator={operator} onSignOut={signOut} />
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
};

export default AdminShell;
