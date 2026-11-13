import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Clock, Download, ExternalLink, Flag, Grid2X2, Inbox, List, Loader2, Search, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { listMarketing, reviewMarketing, downloadMarketing, uploadMarketingRevision, getMarketingAudit } from '@/lib/marketing.functions';
import { CHANGE_CATEGORIES, daysRemaining } from '@/lib/marketing-rules';

type Folder = 'inbox' | 'approved' | 'needs_changes';
const FOLDERS = [
  { id: 'inbox', title: 'Inbox', icon: Inbox },
  { id: 'approved', title: 'Approved', icon: CheckCircle2 },
  { id: 'needs_changes', title: 'Needs changes', icon: Flag },
] as const;
type Submission = Awaited<ReturnType<typeof listMarketing>>[number];

export function MarketingDashboard({ folder = 'inbox', designId }: { folder?: Folder; designId?: string }) {
  const listFn = useServerFn(listMarketing);
  const reviewFn = useServerFn(reviewMarketing);
  const downloadFn = useServerFn(downloadMarketing);
  const uploadFn = useServerFn(uploadMarketingRevision);
  const auditFn = useServerFn(getMarketingAudit);
  const qc = useQueryClient();
  const { data: submissions = [], isLoading, error } = useQuery({ queryKey: ['marketing'], queryFn: () => listFn() });
  const [search, setSearch] = useState('');
  const [grid, setGrid] = useState(folder === 'inbox');
  const [range, setRange] = useState('30');
  const [selected, setSelected] = useState<string[]>([]);
  const [flagIds, setFlagIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [psd, setPsd] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const detail = submissions.find((row) => row.id === designId);
  const activeFolder = detail?.status ?? folder;
  const title = FOLDERS.find((f) => f.id === activeFolder)?.title ?? 'Inbox';
  const rows = submissions.filter((row) => row.status === folder && row.title.toLowerCase().includes(search.toLowerCase()) && (folder !== 'inbox' || range === 'all' || Date.now() - Date.parse(row.submitted_at) <= Number(range) * 86400000));
  const { data: audit = [] } = useQuery({ queryKey: ['marketing-audit', designId], queryFn: () => auditFn({ data: { id: designId ?? '' } }), enabled: Boolean(designId) });
  const decision = useMutation({
    mutationFn: (input: Parameters<typeof reviewFn>[0]) => reviewFn(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing'] }); qc.invalidateQueries({ queryKey: ['marketing-audit'] }); setSelected([]); setFlagIds([]); setDeleteIds([]); toast.success('Review updated.'); },
    onError: (e: Error) => toast.error(e.message),
  });
  function act(ids: string[], action: 'approved') { decision.mutate({ data: { ids, action } }); }
  function flag(ids: string[]) { setCategories([]); setNotes(''); setFlagIds(ids); }
  async function download(ids: string[], kind: 'png' | 'psd') {
    setDownloading(true);
    try {
      for (const id of ids) {
        const file = await downloadFn({ data: { id, kind } });
        const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: kind === 'png' ? 'image/png' : 'image/vnd.adobe.photoshop' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.filename; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      if (kind === 'psd') toast.success('Photoshop file downloaded. Open it in Photoshop on your computer.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Download failed.'); }
    finally { setDownloading(false); }
  }
  const upload = useMutation({
    mutationFn: async () => {
      if (!uploadId || !psd) throw new Error('Select the Photoshop file.');
      const form = new FormData(); form.set('id', uploadId); form.set('psd', psd);
      return uploadFn({ data: form });
    },
    onSuccess: () => { setUploadId(null); setPsd(null); qc.invalidateQueries({ queryKey: ['marketing'] }); qc.invalidateQueries({ queryKey: ['marketing-audit'] }); toast.success('Edited version uploaded. Review it, then click Approve.'); },
    onError: (e: Error) => toast.error(e.message),
  });
  function toggle(id: string) { setSelected(previous => previous.includes(id) ? previous.filter(v => v !== id) : [...previous, id]); }
  const busy = downloading || decision.isPending;

  return <div className="flex min-h-screen bg-background md:h-screen md:overflow-hidden">
    <aside className="flex w-16 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:w-[220px]">
      <div className="px-3 py-6"><img src="/mccoys-logo.png" alt="McCoy's Building Supply" className="h-12 w-full object-contain object-left md:w-28" /><div className="mt-3 hidden font-display text-lg text-sidebar-primary md:block">Design review</div></div>
      <nav className="space-y-1 px-2 md:px-3">{FOLDERS.map(item => <Button key={item.id} variant="ghost" asChild className={`w-full justify-start border-l-2 px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground md:px-3 ${activeFolder === item.id ? 'border-sidebar-primary bg-sidebar-accent' : 'border-transparent'}`} title={item.title}>
        <Link to="/marketing" search={{ folder: item.id }}><item.icon /><span className="hidden md:inline">{item.title}</span><span className="ml-auto hidden text-xs opacity-70 md:inline">{submissions.filter(row => row.status === item.id).length}</span></Link>
      </Button>)}</nav>
      <div className="mt-auto border-t border-sidebar-border p-2 md:p-3"><Button variant="ghost" asChild className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" title="Brand Studio"><Link to="/studio"><ArrowLeft /><span className="hidden md:inline">Brand Studio</span></Link></Button></div>
    </aside>
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3 md:px-7">
        {designId ? <div className="flex min-w-0 items-center gap-3"><Link to="/marketing" search={{ folder: activeFolder }} aria-label="Back to designs"><ArrowLeft className="size-4" /></Link><span className="hidden text-sm text-muted-foreground sm:inline">{title} /</span><span className="truncate text-sm font-semibold">{detail?.title ?? 'Design review'}</span>{detail && <Status row={detail} />}</div> : <label className="flex w-full max-w-md items-center gap-2 rounded-md bg-background px-3"><Search className="size-4 shrink-0 text-muted-foreground" /><Input aria-label="Search Designs" placeholder="Search Designs" value={search} onChange={e => setSearch(e.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" /></label>}
        {designId ? <Button disabled={!detail || busy} onClick={() => detail && download([detail.id], 'psd')} title="Download PSD to open in Photoshop"><ExternalLink /> Open in Photoshop</Button> : <div className="flex rounded-md border p-0.5"><Button size="sm" variant={!grid ? 'ghost' : 'default'} onClick={() => setGrid(true)} aria-label="Grid view"><Grid2X2 /><span className="hidden sm:inline">Grid</span></Button><Button size="sm" variant={grid ? 'ghost' : 'default'} onClick={() => setGrid(false)} aria-label="List view"><List /><span className="hidden sm:inline">List</span></Button></div>}
      </header>
      {isLoading ? <div className="grid flex-1 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div> : error ? <div className="p-8 text-destructive">{error.message}</div> : designId ? detail ? <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
        <section className="flex min-w-0 flex-1 items-center justify-center p-6 lg:p-12"><img src={detail.url ?? ''} alt={detail.title} className="max-h-[70vh] w-full max-w-[470px] object-contain shadow-lg" /></section>
        <aside className="w-full shrink-0 space-y-5 border-t bg-card p-5 lg:w-[340px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <h1 className="text-2xl text-primary">Audit</h1><div className="grid grid-cols-2 gap-2"><Button variant="secondary" disabled={busy} onClick={() => act([detail.id], 'approved')}><Check /> Approve</Button><Button variant="outline" disabled={busy} onClick={() => flag([detail.id])}><Flag /> Needs changes</Button></div>
          {detail.delete_at && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="size-4" /> Deletes in {daysRemaining(detail.delete_at)} days · {new Date(detail.delete_at).toLocaleDateString()}</p>}
          <div className="rounded-md border p-3"><div className="flex justify-between gap-2 text-sm font-semibold"><span>Automated brand check</span><span className="text-success">{checks(detail).filter(c => c.passed).length}/{checks(detail).length} passed</span></div>{checks(detail).length ? <ul className="mt-3 space-y-2">{checks(detail).map(c => <li key={c.label} className="flex items-start gap-2 text-xs"><CheckCircle2 className={`size-4 shrink-0 ${c.passed ? 'text-success' : 'text-muted-foreground'}`} /><span className="flex-1">{c.label}</span><span className="max-w-[45%] text-right text-muted-foreground">{c.detail}</span></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">Edited upload · manual review</p>}</div>
          <section><h2 className="font-sans text-xs font-semibold text-muted-foreground">FILES</h2><div className="mt-2 space-y-1">{(['psd','png'] as const).map(kind => <Button key={kind} variant="ghost" disabled={busy} className="w-full justify-start px-0 text-xs" onClick={() => download([detail.id], kind)}><span className="rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-bold text-secondary">{kind.toUpperCase()}</span><span className="truncate">{detail.title}_v{detail.version_number}.{kind}</span><Download className="ml-auto" /></Button>)}</div></section>
          <div className="space-y-2 text-xs"><p><span className="text-muted-foreground">Submitted by </span>{detail.sender_email || 'Store manager'}</p><p><span className="text-muted-foreground">Sent </span>{new Date(detail.submitted_at).toLocaleString()}</p>{detail.needed_by && <p>Needed by {detail.needed_by}</p>}{detail.uses && <p>{detail.uses}</p>}</div>
          {detail.notes && <div className="border-l-2 border-secondary pl-3 text-sm"><p className="font-semibold">{detail.change_categories.join(', ')}</p><p className="mt-1 whitespace-pre-wrap">{detail.notes}</p></div>}
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setUploadId(detail.id)}><Upload /> Upload edited version</Button><Button size="icon" variant="outline" onClick={() => setDeleteIds([detail.id])} aria-label="Delete design" title="Delete"><Trash2 /></Button></div>
          <section className="border-t pt-4"><h2 className="text-xl text-primary">Activity</h2><ul className="mt-2 space-y-3">{audit.length ? audit.map(event => <li key={event.id} className="text-xs"><p className="font-semibold capitalize">{event.action.replaceAll('_',' ')}</p>{event.notes && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{event.notes}</p>}<time className="text-muted-foreground">{new Date(event.created_at).toLocaleString()}</time></li>) : <li className="text-xs text-muted-foreground">Submitted for review</li>}</ul></section>
        </aside>
      </div> : <div className="p-8 text-muted-foreground">This design is unavailable or has been deleted.<Link to="/marketing" search={{ folder: 'inbox' }} className="ml-2 text-primary underline">Return to Inbox</Link></div> : <section className="flex-1 overflow-y-auto px-4 py-6 md:px-7">
        <div className="flex items-center justify-between gap-3"><div><h1 className="text-3xl text-primary">{title}</h1><p className="mt-1 text-xs text-muted-foreground">{rows.length} {folder === 'inbox' ? 'designs waiting for review' : folder === 'approved' ? 'approved designs · shared with the design team' : 'designs flagged for changes'}</p></div>{folder === 'inbox' && <select aria-label="Sent date filter" className="rounded-md border bg-card px-3 py-2 text-xs" value={range} onChange={e => setRange(e.target.value)}><option value="30">Sent: last 30 days</option><option value="7">Sent: last 7 days</option><option value="all">All submissions</option></select>}</div>
        {folder === 'approved' && <div className="mt-4 flex items-center gap-3 rounded-md border-l-4 border-secondary bg-accent px-4 py-3 text-xs"><Clock className="size-4 shrink-0" /><span>Approved designs are permanently deleted 30 days after approval.</span></div>}
        {selected.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground"><span className="mr-auto text-xs font-semibold text-secondary">{selected.length} selected</span><Button size="sm" variant="ghost" className="text-primary-foreground" disabled={busy} onClick={() => download(selected,'psd')}><ExternalLink /> Photoshop</Button><Button size="sm" variant="ghost" className="text-primary-foreground" disabled={busy} onClick={() => download(selected,'png')}><Download /> PNG</Button><Button size="sm" variant="ghost" className="text-primary-foreground" disabled={busy} onClick={() => act(selected,'approved')}><Check /> Approve</Button><Button size="sm" variant="ghost" className="text-primary-foreground" onClick={() => flag(selected)}><Flag /> Changes</Button>{selected.length === 1 && <Button size="sm" variant="ghost" className="text-primary-foreground" onClick={() => setUploadId(selected[0] ?? null)}><Upload /></Button>}<Button size="icon" variant="ghost" className="text-primary-foreground" onClick={() => setDeleteIds(selected)} aria-label="Delete selected"><Trash2 /></Button><Button size="icon" variant="ghost" className="text-primary-foreground" onClick={() => setSelected([])} aria-label="Clear selection"><X /></Button></div>}
        {rows.length === 0 ? <div className="grid min-h-72 place-content-center text-center"><Inbox className="mx-auto size-10 text-primary/40" /><h2 className="mt-4 text-2xl text-primary">{search ? 'No matching designs' : 'Nothing here yet'}</h2><p className="mt-2 text-sm text-muted-foreground">{search ? 'Try another search.' : folder === 'inbox' ? 'Manager submissions will appear here.' : 'No designs in this folder.'}</p></div> : grid ? <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{rows.map(row => <article key={row.id} className="group relative overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary"><div className="absolute top-3 left-3 z-10"><Checkbox checked={selected.includes(row.id)} onCheckedChange={() => toggle(row.id)} aria-label={`Select ${row.title}`} className="bg-card" /></div><Link to="/marketing/$submissionId" params={{ submissionId: row.id }} className="block"><div className="flex h-44 justify-center bg-muted p-2"><img src={row.url ?? ''} alt={row.title} className="h-full max-w-full object-contain" /></div><div className="p-3"><p className="truncate text-sm font-semibold">{row.title}</p><div className="mt-1"><Status row={row} /></div></div></Link><div className="flex gap-2 border-t p-2"><Button size="sm" variant="secondary" className="flex-1" disabled={busy} onClick={() => act([row.id],'approved')}><Check /> Approve</Button>{row.status === 'needs_changes' ? <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => setUploadId(row.id)}><Upload /> Upload</Button> : <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => flag([row.id])}><Flag /> Changes</Button>}</div></article>)}</div> : <div className="mt-5 overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-background text-[10px] text-muted-foreground"><tr><th className="w-10 p-3"><Checkbox aria-label="Select all designs" checked={rows.every(row => selected.includes(row.id))} onCheckedChange={value => setSelected(value ? rows.map(r => r.id) : [])} /></th><th className="p-3 font-medium">NAME</th><th className="p-3 font-medium">{folder === 'approved' ? 'APPROVED' : 'SENT'}</th><th className="p-3 font-medium">STATUS</th><th className="p-3 font-medium">{folder === 'needs_changes' ? 'WHAT TO CHANGE' : 'DELETES IN'}</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className={`border-t ${selected.includes(row.id) ? 'bg-accent' : 'hover:bg-muted/50'}`}><td className="p-3"><Checkbox checked={selected.includes(row.id)} onCheckedChange={() => toggle(row.id)} aria-label={`Select ${row.title}`} /></td><td className="p-3"><Link to="/marketing/$submissionId" params={{ submissionId: row.id }} className="flex items-center gap-3"><img src={row.url ?? ''} alt="" className="h-9 w-7 object-contain" /><span><span className="block font-semibold">{row.title}</span><span className="text-[10px] text-muted-foreground">Flyer v{row.version_number} · PSD + PNG</span></span></Link></td><td className="p-3">{new Date(row.approved_at ?? row.submitted_at).toLocaleDateString()}</td><td className="p-3"><Status row={row} /></td><td className="p-3">{folder === 'needs_changes' ? row.change_categories.join(', ') || 'See notes' : row.delete_at ? `${daysRemaining(row.delete_at)} days` : '—'}</td></tr>)}</tbody></table></div>}
      </section>}
    </main>
    <Dialog open={flagIds.length > 0} onOpenChange={open => !open && setFlagIds([])}><DialogContent className="max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-3 text-3xl text-primary"><Flag /> Flag: needs changes</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{flagIds.length === 1 ? submissions.find(r => r.id === flagIds[0])?.title : `${flagIds.length} designs`}</p><div><p className="mb-2 text-sm font-semibold">What needs to change?</p><div className="flex flex-wrap gap-2">{CHANGE_CATEGORIES.map(category => <Button key={category} size="sm" variant={categories.includes(category) ? 'secondary' : 'outline'} aria-pressed={categories.includes(category)} onClick={() => setCategories(previous => previous.includes(category) ? previous.filter(c => c !== category) : [...previous, category])}>{categories.includes(category) && <Check />}{category}</Button>)}</div></div><label className="space-y-2 text-sm font-semibold">Notes for the team<Textarea className="mt-2 min-h-24 font-normal" value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} /></label><DialogFooter><Button variant="outline" onClick={() => setFlagIds([])}>Cancel</Button><Button disabled={decision.isPending || (!categories.length && !notes.trim())} onClick={() => decision.mutate({ data: { ids: flagIds, action: 'needs_changes', categories, notes } })}><Flag /> Move to Needs changes</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={deleteIds.length > 0} onOpenChange={open => !open && setDeleteIds([])}><DialogContent><DialogHeader><DialogTitle className="text-3xl text-primary">Delete permanently?</DialogTitle></DialogHeader><p className="text-sm">This removes {deleteIds.length} submission(s), their review history, and the team's files. This cannot be undone. The manager's original studio design is kept.</p><DialogFooter><Button variant="outline" onClick={() => setDeleteIds([])}>Cancel</Button><Button variant="destructive" disabled={decision.isPending} onClick={() => decision.mutate({ data: { ids: deleteIds, action: 'delete' } })}><Trash2 /> Delete now</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(uploadId)} onOpenChange={open => !open && setUploadId(null)}><DialogContent><DialogHeader><DialogTitle className="text-3xl text-primary">Upload edited version</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Upload the edited Photoshop file. A preview is made from it automatically. Then review it and click Approve.</p><label className="space-y-2 text-sm font-semibold">Photoshop file<Input type="file" aria-label="Photoshop file" accept=".psd" onChange={e => setPsd(e.target.files?.[0] ?? null)} /></label><DialogFooter><Button variant="outline" onClick={() => setUploadId(null)}>Cancel</Button><Button disabled={!psd || upload.isPending} onClick={() => upload.mutate()}><Upload /> Upload edited version</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
function Status({ row }: { row: Submission }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${row.status === 'approved' ? 'bg-success text-primary-foreground' : row.status === 'needs_changes' ? 'bg-primary text-secondary' : 'bg-secondary text-secondary-foreground'}`}>{row.status === 'inbox' ? 'New' : row.status.replaceAll('_',' ')}</span>;
}
function checks(row: Submission): { label: string; detail: string; passed: boolean }[] {
  if (!Array.isArray(row.checks)) return [];
  return row.checks.flatMap(c => c && typeof c === 'object' && !Array.isArray(c) && typeof c['label'] === 'string' ? [{ label: c['label'], detail: typeof c['detail'] === 'string' ? c['detail'] : '', passed: c['passed'] === true }] : []);
}