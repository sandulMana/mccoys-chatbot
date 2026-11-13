import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { validateReviewFile } from './marketing-rules';

export const listMarketing = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('marketing_submissions').select('*').order('submitted_at', { ascending: false });
  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map(async (row) => {
    // Legacy submissions reference the original owner's private image; authorize through the shared submission first.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: url, error: signingError } = await supabaseAdmin.storage.from('flyers').createSignedUrl(row.png_path, 3600);
    if (signingError) throw new Error(signingError.message);
    return { ...row, url: url?.signedUrl ?? null };
  }));
});

export const getMarketingAudit = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: events, error } = await context.supabase.from('marketing_audit_events').select('*').eq('submission_id', data.id).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return events ?? [];
  });

export const reviewMarketing = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[]; action: 'approved' | 'needs_changes' | 'delete'; notes?: string; categories?: string[] }) => z.object({ ids: z.array(z.string().uuid()).min(1).max(100), action: z.enum(['approved','needs_changes','delete']), notes: z.string().max(2000).default(''), categories: z.array(z.string().max(50)).max(6).default([]) }).parse(input))
  .handler(async ({ context, data }) => {
    for (const id of data.ids) {
      const { data: row, error } = await context.supabase.from('marketing_submissions').select('*').eq('id', id).single();
      if (error || !row) throw new Error('Submission not found.');
      if (data.action === 'delete') {
        const { purgeMarketingSubmission } = await import('./marketing-cleanup.server');
        await purgeMarketingSubmission(row.id);
      } else {
        const { error: updateError } = await context.supabase.from('marketing_submissions').update({ status: data.action, notes: data.notes, change_categories: data.categories, ...(data.action === 'approved' ? { manager_seen_at: null } : {}) }).eq('id', id);
        if (updateError) throw new Error(updateError.message);
        const { error: auditError } = await context.supabase.from('marketing_audit_events').insert({ submission_id: id, actor_id: context.userId, action: data.action, notes: [data.categories.join(', '), data.notes].filter(Boolean).join(' — ') });
        if (auditError) throw new Error(auditError.message);
      }
    }
    return { ok: true };
  });

export const downloadMarketing = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; kind: 'png' | 'psd' }) => z.object({ id: z.string().uuid(), kind: z.enum(['png','psd']) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase.from('marketing_submissions').select('*').eq('id', data.id).single();
    if (error || !row) throw new Error('Submission not found.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const path = data.kind === 'psd' ? row.psd_path : row.png_path;
    let bytes: Uint8Array;
    const file = await supabaseAdmin.storage.from('flyers').download(path ?? row.png_path);
    if (file.error) throw new Error(file.error.message);
    bytes = new Uint8Array(await file.data.arrayBuffer());
    if (!path && data.kind === 'psd') { const { pngToPsd } = await import('./psd.server'); bytes = pngToPsd(bytes); }
    const { Buffer } = await import('node:buffer');
    return { base64: Buffer.from(bytes).toString('base64'), filename: `${row.title.replace(/[^a-z0-9-]/gi, '-')}-v${row.version_number}.${data.kind}` };
  });

export const uploadMarketingRevision = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: FormData) => { if (!(input instanceof FormData)) throw new Error('Select your files.'); return input; })
  .handler(async ({ context, data }) => {
    const id = z.string().uuid().parse(data.get('id'));
    const { data: row, error } = await context.supabase.from('marketing_submissions').select('*').eq('id', id).single();
    if (error || !row) throw new Error('Submission not found.');
    const pngFile = data.get('png');
    if (!(pngFile instanceof Blob)) throw new Error('Select a PNG or PDF file.');
    const pngBytes = new Uint8Array(await pngFile.arrayBuffer());
    validateReviewFile(pngBytes, 'png');
    const { pngToPsd } = await import('./psd.server');
    const psdBytes = pngToPsd(pngBytes);
    const paths: Record<'png' | 'psd', string> = { png: '', psd: '' };
    for (const [kind, bytes] of [['png', pngBytes], ['psd', psdBytes]] as const) {
      paths[kind] = `marketing/${context.userId}/${id}/${crypto.randomUUID()}.${kind}`;
      const { error: uploadError } = await context.supabase.storage.from('flyers').upload(paths[kind], bytes, { contentType: kind === 'png' ? 'image/png' : 'image/vnd.adobe.photoshop' });
      if (uploadError) throw new Error(uploadError.message);
    }
    const { error: updateError } = await context.supabase.from('marketing_submissions').update({ png_path: paths.png, psd_path: paths.psd, version_number: row.version_number + 1, checks: [] }).eq('id', id);
    if (updateError) throw new Error(updateError.message);
    await context.supabase.from('marketing_audit_events').insert({ submission_id: id, actor_id: context.userId, action: 'edited version uploaded' });
    return { ok: true };
  });
export const listManagerInbox = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('marketing_submissions').select('*').eq('submitted_by', context.userId).eq('status', 'approved').order('approved_at', { ascending: false });
  if (error) throw new Error(error.message);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const items = await Promise.all((data ?? []).map(async (row) => {
    const { data: url } = await supabaseAdmin.storage.from('flyers').createSignedUrl(row.png_path, 3600);
    return { ...row, url: url?.signedUrl ?? null };
  }));
  return { items, unread: items.filter((row) => !row.manager_seen_at).length };
});

export const markInboxSeen = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[] }) => z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from('marketing_submissions').update({ manager_seen_at: new Date().toISOString() }).in('id', data.ids).eq('submitted_by', context.userId).is('manager_seen_at', null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
