import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, Download, Loader2 } from "lucide-react";
import { addPrompt, generateVersion, getDesign, sendToMarketing, MARKETING_EMAIL } from "@/lib/studio.functions";
import { Composer } from "@/components/Composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/studio/$designId")({
  head: () => ({ meta: [
    { title: "Edit flyer · McCoy's Brand Studio" },
    { name: "description", content: "Review and refine your McCoy's flyer designs." },
    { property: "og:title", content: "Edit flyer · McCoy's Brand Studio" },
    { property: "og:description", content: "Review and refine your McCoy's flyer designs." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: DesignPage,
});

type Version = { id: string; version_number: number; url?: string; checks: { label: string; detail: string; passed: boolean }[] };

function DesignPage() {
  const { designId } = Route.useParams();
  const fetchDesign = useServerFn(getDesign);
  const gen = useServerFn(generateVersion);
  const add = useServerFn(addPrompt);
  const send = useServerFn(sendToMarketing);
  const qc = useQueryClient();
  const key = ["design", designId];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => fetchDesign({ data: { id: designId } }) });
  const [selected, setSelected] = useState<number | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [neededBy, setNeededBy] = useState("");
  const [uses, setUses] = useState("In-store print, Social media");
  const started = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const generate = useMutation({
    mutationFn: () => gen({ data: { designId } }),
    onSuccess: () => {
      setSelected(null);
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["designs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const messages = (data?.messages ?? []) as any[];
  const versions = (data?.versions ?? []) as Version[];
  const last = messages[messages.length - 1];
  const needsReply = last?.role === "user";

  useEffect(() => {
    if (needsReply && !generate.isPending && started.current !== last.id) {
      started.current = last.id;
      generate.mutate();
    }
  }, [needsReply, last?.id, generate]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, generate.isPending]);

  async function onSend(text: string) {
    qc.setQueryData(key, (old: any) =>
      old ? { ...old, messages: [...old.messages, { id: `tmp-${Date.now()}`, role: "user", content: text }] } : old,
    );
    try {
      await add({ data: { designId, prompt: text } });
      await qc.invalidateQueries({ queryKey: key });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const sendMut = useMutation({
    mutationFn: () => send({ data: { designId, neededBy, uses } }),
    onSuccess: () => {
      setSendOpen(false);
      toast.success("Sent! Marketing will review and reply.");
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["designs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="grid flex-1 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const design = data.design as any;
  const current = versions.find((v) => v.version_number === selected) ?? versions[versions.length - 1];
  const latest = versions[versions.length - 1];
  const isSent = design.status === "sent";
  const busy = generate.isPending || needsReply;
  const passed = current?.checks.filter((c) => c.passed).length ?? 0;

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b bg-card px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate font-sans text-xl font-semibold tracking-normal">{design.title}</h2>
            {isSent && latest && (
              <span className="rounded-full bg-success px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-primary-foreground">
                SENT · V{latest.version_number} LOCKED
              </span>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-primary">
            <span className="h-2 w-2 rounded-full bg-success" /> McCoy's brand guidelines active
          </span>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl bg-primary px-5 py-3 text-primary-foreground">{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <AgentAvatar />
                <div className="max-w-[75%] space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Brand Studio AI</div>
                  <div className="rounded-2xl border bg-card px-5 py-3">{m.content}</div>
                  {m.adjustments?.length > 0 && (
                    <div className="rounded-lg border-l-4 border-secondary bg-accent px-4 py-3 text-sm">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="h-4 w-4" /> Adjusted to stay on-brand
                      </div>
                      {m.adjustments.map((a: any, i: number) => (
                        <div key={i} className="mt-1">
                          {a.requested} → {a.applied}
                        </div>
                      ))}
                    </div>
                  )}
                  {m.version_number && (
                    <button
                      onClick={() => setSelected(m.version_number)}
                      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left hover:border-primary"
                    >
                      <span className="h-8 w-8 rounded bg-primary" />
                      <span>
                        <span className="block font-semibold">
                          Flyer v{m.version_number}
                          {m.version_number === latest?.version_number ? " · Current" : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">Letter · 8.5 × 11 in</span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex gap-3">
              <AgentAvatar />
              <div className="flex items-center gap-2 rounded-2xl border bg-card px-5 py-3 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Designing your on-brand flyer… this can take a minute.
              </div>
            </div>
          )}
          {generate.isError && !busy && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => generate.mutate()}>Try again</Button>
            </div>
          )}
          {isSent && (
            <div className="flex items-center gap-3 rounded-xl border border-success bg-success-soft px-5 py-4">
              <CheckCircle2 className="h-7 w-7 text-success" />
              <div>
                <div className="font-semibold">Flyer v{latest?.version_number} sent to McCoy's Marketing Team</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(design.sent_at).toLocaleString()} · {MARKETING_EMAIL}
                </div>
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>

        <div className="border-t bg-background px-6 pt-4 pb-3">
          <Composer
            onSend={onSend}
            disabled={busy}
            placeholder={isSent ? `v${latest?.version_number} is locked. Ask for changes to start v${(latest?.version_number ?? 0) + 1}…` : "Ask for changes…"}
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Brand Studio follows McCoy's Primary Logo & Guidelines. Off-brand requests are adjusted automatically.
          </p>
        </div>
      </section>

      <aside className="flex w-[26rem] shrink-0 flex-col gap-5 overflow-y-auto border-l bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl text-primary">Live preview</h2>
          {versions.length > 0 && (
            <select
              value={current?.version_number}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="rounded-md border bg-card px-2 py-1 text-sm"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.version_number}>
                  v{v.version_number} of {versions.length}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="grid aspect-[2/3] shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
          {current?.url ? (
            <img src={current.url} alt={`Flyer v${current.version_number}`} className="h-full w-full object-contain" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Generating…" : "No flyer yet"}
            </div>
          )}
        </div>
        {current && (
          <div className="rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-base font-semibold tracking-normal">Brand compliance</h3>
              <span className="rounded-full bg-success px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                {passed}/{current.checks.length} PASSED
              </span>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {current.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="flex-1">{c.label}</span>
                  <span className="max-w-[45%] text-right text-muted-foreground">{c.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-auto space-y-3">
          <Button
            className="w-full"
            size="lg"
            variant={isSent ? "outline" : "default"}
            disabled={!latest || isSent || busy}
            onClick={() => setSendOpen(true)}
          >
            {isSent ? (<><Check className="h-4 w-4" /> Sent to Marketing</>) : "Send to Marketing"}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" disabled={!current?.url} asChild={!!current?.url}>
              {current?.url ? (
                <a href={current.url} download={`${design.title}-v${current.version_number}.png`} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" /> Download
                </a>
              ) : (
                <span>Download</span>
              )}
            </Button>
            <Button variant="outline" disabled={versions.length < 2} onClick={() => setCompareOpen(true)}>
              Compare versions
            </Button>
          </div>
        </div>
      </aside>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-3xl text-primary">Send v{latest?.version_number} to Marketing</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This locks the version and sends it to {MARKETING_EMAIL}.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nb">Needed by</Label>
              <Input id="nb" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="uses">Where it will be used</Label>
              <Input id="uses" value={uses} onChange={(e) => setUses(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => sendMut.mutate()} disabled={sendMut.isPending}>
              {sendMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-3xl text-primary">Compare versions</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[70vh] grid-cols-3 gap-4 overflow-y-auto">
            {versions.map((v) => (
              <figure key={v.id}>
                {v.url && <img src={v.url} alt={`v${v.version_number}`} className="rounded-lg border" />}
                <figcaption className="mt-1 text-center text-sm font-medium">v{v.version_number}</figcaption>
              </figure>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AgentAvatar() {
  return (
    <div className="font-display grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-2xl text-secondary-foreground">
      M
    </div>
  );
}
