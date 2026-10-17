import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { LogOut, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listDesigns } from "@/lib/studio.functions";

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({
    meta: [
      { title: "Brand Studio · McCoy's" },
      { name: "description", content: "Your McCoy's flyer designs." },
      { property: "og:title", content: "Brand Studio · McCoy's" },
      { property: "og:description", content: "Your McCoy's flyer designs." },
    ],
  }),
  component: StudioLayout,
});

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
}

function StudioLayout() {
  const { user } = Route.useRouteContext();
  const fetchDesigns = useServerFn(listDesigns);
  const { data: designs = [] } = useQuery({ queryKey: ["designs"], queryFn: () => fetchDesigns() });
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const name = (user.user_metadata?.['full_name'] as string) || user.email || "Manager";
  const initials = name.split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");

  const groups = useMemo(() => {
    const f = designs.filter((d) => d.title.toLowerCase().includes(q.toLowerCase()));
    const dayAgo = Date.now() - 864e5;
    return [
      { label: "Today", items: f.filter((d) => new Date(d.updated_at).getTime() > dayAgo) },
      { label: "Earlier", items: f.filter((d) => new Date(d.updated_at).getTime() <= dayAgo) },
    ].filter((g) => g.items.length);
  }, [designs, q]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-72 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="p-5">
          <img src="/mccoys-logo.png" alt="McCoy's Building Supply" className="h-12 w-24 object-contain" />
          <div className="font-display mt-2 text-2xl tracking-[0.2em] text-sidebar-primary">Brand Studio</div>
          <Link
            to="/studio"
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-sidebar-primary py-2.5 font-semibold text-sidebar-primary-foreground transition hover:brightness-95"
          >
            <Plus className="h-4 w-4" /> New design
          </Link>
          <label className="mt-3 flex items-center gap-2 rounded-lg bg-sidebar-muted px-3 py-2 text-sm">
            <Search className="h-4 w-4 opacity-70" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search designs"
              className="w-full bg-transparent outline-none placeholder:text-sidebar-foreground/60"
            />
          </label>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.length === 0 && <p className="px-2 text-sm opacity-70">No designs yet.</p>}
          {groups.map((g) => (
            <div key={g.label} className="mb-4">
              <div className="px-2 pb-1 text-xs font-semibold tracking-widest opacity-70 uppercase">{g.label}</div>
              {g.items.map((d) => (
                <Link
                  key={d.id}
                  to="/studio/$designId"
                  params={{ designId: d.id }}
                  className="block rounded-lg border-l-4 border-transparent px-3 py-2 hover:bg-sidebar-accent"
                  activeProps={{ className: "bg-sidebar-accent border-sidebar-primary" }}
                >
                  <div className="truncate font-medium">{d.title}</div>
                  <div className="text-xs opacity-70">
                    {d.status === "sent" ? "Sent to Marketing" : "Draft"}
                    {d.versions ? ` · v${d.versions}` : ""} · {ago(d.updated_at)}
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-3 border-t border-sidebar-border p-4">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-sidebar-primary font-bold text-sidebar-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{name}</div>
            <div className="truncate text-xs opacity-70">{user.email}</div>
          </div>
          <button onClick={signOut} aria-label="Sign out" className="rounded p-1 hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
