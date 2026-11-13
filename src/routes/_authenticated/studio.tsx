import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CheckCircle2, Flag, Inbox, LogOut, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from "@/integrations/supabase/client";
import { listManagerInbox } from "@/lib/marketing.functions";
import { deleteDesign, listDesigns, renameDesign, setDesignFlag } from "@/lib/studio.functions";

type DesignItem = {
  id: string;
  title: string;
  status: string;
  flagged: boolean;
  updated_at: string;
  versions: number;
};

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({
    meta: [
      { title: "Brand Studio · McCoy's" },
      { name: "description", content: "Your McCoy's flyer designs." },
      { property: "og:title", content: "Brand Studio · McCoy's" },
      { property: "og:description", content: "Your McCoy's flyer designs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const callRename = useServerFn(renameDesign);
  const callFlag = useServerFn(setDesignFlag);
  const callDelete = useServerFn(deleteDesign);
  const { data: designs = [] } = useQuery({ queryKey: ["designs"], queryFn: () => fetchDesigns() });
  const fetchInbox = useServerFn(listManagerInbox);
  const { data: inbox } = useQuery({ queryKey: ["manager-inbox"], queryFn: () => fetchInbox(), refetchInterval: 30000 });
  const unread = inbox?.unread ?? 0;
  const [q, setQ] = useState("");
  const [renaming, setRenaming] = useState<DesignItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<DesignItem | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const activeDesignId = useParams({ strict: false, select: (p) => (p as { designId?: string }).designId });

  const refresh = () => qc.invalidateQueries({ queryKey: ["designs"] });

  async function submitRename() {
    if (!renaming || !renameValue.trim()) return;
    setBusy(true);
    try {
      await callRename({ data: { designId: renaming.id, title: renameValue.trim() } });
      setRenaming(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleFlag(d: DesignItem) {
    await callFlag({ data: { designId: d.id, flagged: !d.flagged } });
    await refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await callDelete({ data: { designId: deleting.id } });
      const wasActive = activeDesignId === deleting.id;
      setDeleting(null);
      await refresh();
      if (wasActive) navigate({ to: "/studio" });
    } finally {
      setBusy(false);
    }
  }
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
            <Plus className="h-4 w-4" /> New Design
          </Link>
          <label className="mt-3 flex items-center gap-2 rounded-lg bg-sidebar-muted px-3 py-2 text-sm">
            <Search className="h-4 w-4 opacity-70" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Designs"
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
                <div key={d.id} className="group relative">
                  <Link
                    to="/studio/$designId"
                    params={{ designId: d.id }}
                    className="block rounded-lg border-l-4 border-transparent px-3 py-2 pr-8 hover:bg-sidebar-accent"
                    activeProps={{ className: "bg-sidebar-accent border-sidebar-primary" }}
                  >
                    <div className="flex items-center gap-1.5 truncate font-medium">
                      {d.flagged && <Flag className="h-3.5 w-3.5 shrink-0 fill-sidebar-primary text-sidebar-primary" />}
                      <span className="truncate">{d.title}</span>
                    </div>
                    <div className="text-xs opacity-70">
                      {d.status === "sent" ? "Sent to Marketing" : "Draft"}
                      {d.versions ? ` · v${d.versions}` : ""} · {ago(d.updated_at)}
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label={`Options for ${d.title}`}
                        className="absolute top-2 right-1.5 rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-sidebar-accent focus:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="right">
                      <DropdownMenuItem onSelect={() => { setRenaming(d); setRenameValue(d.title); }}>
                        <Pencil className="h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => toggleFlag(d)}>
                        <Flag className="h-4 w-4" /> {d.flagged ? "Unflag" : "Flag"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleting(d)}>
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="space-y-1 px-3 pb-3"><Button asChild variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"><Link to="/studio/inbox"><CheckCircle2 /> Approved Inbox{unread > 0 && <span className="ml-auto rounded-full bg-sidebar-primary px-2 py-0.5 text-xs font-bold text-sidebar-primary-foreground">{unread}</span>}</Link></Button><Button asChild variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"><Link to="/marketing" search={{ folder: 'inbox' }}><Inbox /> Marketing Review</Link></Button></div>
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

      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Design</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); void submitRename(); }}
            className="space-y-4"
          >
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Design name"
              maxLength={120}
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
              <Button type="submit" disabled={busy || !renameValue.trim()}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the chat, its flyer versions, and files. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
