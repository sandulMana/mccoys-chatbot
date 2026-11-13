import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { downloadMarketing, listManagerInbox, markInboxSeen } from '@/lib/marketing.functions';
import { daysRemaining } from '@/lib/marketing-rules';
import { saveBase64File } from '@/lib/download-file';

export const Route = createFileRoute('/_authenticated/studio/inbox')({
  head: () => ({ meta: [
    { title: "Approved inbox · McCoy's Brand Studio" },
    { name: 'description', content: 'Designs approved by the marketing team, ready to download.' },
  ] }),
  component: ApprovedInbox,
});

function ApprovedInbox() {
  const listFn = useServerFn(listManagerInbox);
  const seenFn = useServerFn(markInboxSeen);
  const downloadFn = useServerFn(downloadMarketing);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['manager-inbox'], queryFn: () => listFn(), refetchInterval: 30000 });
  const [busyId, setBusyId] = useState<string | null>(null);
  const seen = useMutation({ mutationFn: (ids: string[]) => seenFn({ data: { ids } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['manager-inbox'] }) });
  const unseenIds = (data?.items ?? []).filter((row) => !row.manager_seen_at).map((row) => row.id).join(',');
  useEffect(() => { if (unseenIds) seen.mutate(unseenIds.split(',')); }, [unseenIds]); // eslint-disable-line react-hooks/exhaustive-deps

  async function download(id: string, kind: 'png' | 'pdf') {
    setBusyId(id + kind);
    try {
      const file = await downloadFn({ data: { id, kind } });
      saveBase64File(file.base64, file.filename, kind === 'png' ? 'image/png' : 'application/pdf');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Download failed.'); }
    finally { setBusyId(null); }
  }

  return <section className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
    <h1 className="flex items-center gap-3 text-3xl text-primary"><CheckCircle2 /> Approved inbox</h1>
    <p className="mt-1 text-sm text-muted-foreground">Designs the marketing team approved. Download them here.</p>
    <div className="mt-4 flex items-center gap-3 rounded-md border-l-4 border-secondary bg-accent px-4 py-3 text-xs"><Clock className="size-4 shrink-0" /><span>Approved designs are permanently deleted 30 days after approval, so download what you need.</span></div>
    {isLoading ? <div className="grid min-h-48 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
      : error ? <p className="mt-6 text-destructive">{error.message}</p>
      : !data?.items.length ? <p className="mt-10 text-center text-muted-foreground">Nothing approved yet. Approved designs will show up here.</p>
      : <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.items.map((row) => <article key={row.id} className="overflow-hidden rounded-lg border bg-card">
        <div className="flex h-52 justify-center bg-muted p-2"><img src={row.url ?? ''} alt={row.title} className="h-full max-w-full object-contain" /></div>
        <div className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-semibold">{row.title}</p>{!row.manager_seen_at && <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold uppercase text-secondary-foreground">New</span>}</div>
          <p className="text-xs text-muted-foreground">v{row.version_number} · Approved {row.approved_at ? new Date(row.approved_at).toLocaleDateString() : ''}{row.delete_at ? ` · Deletes in ${daysRemaining(row.delete_at)} days` : ''}</p>
          {row.notes && <p className="whitespace-pre-wrap border-l-2 border-secondary pl-2 text-xs">{row.notes}</p>}
          <div className="grid grid-cols-2 gap-2"><Button size="sm" disabled={busyId !== null} onClick={() => download(row.id, 'png')}><Download /> PNG</Button><Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => download(row.id, 'pdf')}><FileText /> PDF</Button></div>
        </div>
      </article>)}</div>}
  </section>;
}
