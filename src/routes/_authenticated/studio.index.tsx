import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { createDesign } from "@/lib/studio.functions";
import { Composer } from "@/components/Composer";
import { BrandKit } from "@/components/BrandKit";

export const Route = createFileRoute("/_authenticated/studio/")({
  head: () => ({ meta: [
    { title: "New design · McCoy's Brand Studio" },
    { name: "description", content: "Create a new McCoy's marketing flyer." },
    { property: "og:title", content: "New design · McCoy's Brand Studio" },
    { property: "og:description", content: "Create a new McCoy's marketing flyer." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: NewDesign,
});

const IDEAS = [
  { t: "Sale flyer", p: "20% off cedar pickets this weekend at our Round Rock store" },
  { t: "Event announcement", p: "Contractor Night — free breakfast tacos, Thursday 6:30am" },
  { t: "Now hiring poster", p: "Hiring yard crew and drivers, apply at the service desk" },
  { t: "Store hours notice", p: "Holiday hours for Thanksgiving week" },
];

function NewDesign() {
  const create = useServerFn(createDesign);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function start(prompt: string) {
    setBusy(true);
    try {
      const { id } = await create({ data: { prompt } });
      navigate({ to: "/studio/$designId", params: { designId: id } });
    } catch (e: any) {
      toast.error(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <section className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 py-10">
        <img src="/mccoys-logo.png" alt="McCoy's Building Supply" className="h-20 w-40 object-contain" />
        <h1 className="mt-6 text-center text-6xl text-primary">What are we building today?</h1>
        <p className="mt-3 max-w-lg text-center text-muted-foreground">
          Describe your promo and I'll design an on-brand flyer. Logo, colors, and fonts follow McCoy's guidelines automatically.
        </p>
        <div className="mt-8 grid w-full max-w-3xl grid-cols-2 gap-4">
          {IDEAS.map((i) => (
            <button
              key={i.t}
              disabled={busy}
              onClick={() => start(`${i.t}: ${i.p}`)}
              className="rounded-xl border bg-card p-4 text-left transition hover:border-primary hover:shadow-md"
            >
              <div className="flex items-center gap-2 font-semibold text-primary">
                <span className="h-4 w-1 rounded bg-secondary" />
                {i.t}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">“{i.p}”</div>
            </button>
          ))}
        </div>
        <div className="mt-8 w-full max-w-3xl">
          <Composer onSend={start} disabled={busy} placeholder="e.g. Fall fence sale flyer, 20% off cedar pickets, Oct 18–27…" />
        </div>
      </section>
      <aside className="w-[26rem] shrink-0 space-y-5 overflow-y-auto border-l bg-card p-6">
        <h2 className="text-3xl text-primary">Live preview</h2>
        <div className="grid aspect-[3/4] place-items-center rounded-xl border-2 border-dashed bg-background text-center">
          <div>
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="mt-3 font-semibold">Your flyer will appear here</div>
            <div className="text-sm text-muted-foreground">Every version is checked against the brand kit below.</div>
          </div>
        </div>
        <BrandKit />
      </aside>
    </>
  );
}
