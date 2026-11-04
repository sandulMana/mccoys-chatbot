import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { pngToPsd } from './psd.server';

export async function submitMarketingSnapshot(sb: SupabaseClient<Database>, input: {
  designId: string; versionId: string; userId: string; email: string; title: string;
  versionNumber: number; png: Uint8Array; checks: Database['public']['Tables']['marketing_submissions']['Insert']['checks']; neededBy: string; uses: string;
}) {
  const { data: existing, error: existingError } = await sb.from('marketing_submissions').select('id').eq('version_id', input.versionId).maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  const prefix = `marketing/${input.userId}/${id}`;
  const pngPath = `${prefix}/original.png`;
  const psdPath = `${prefix}/original.psd`;
  const pngUpload = await sb.storage.from('flyers').upload(pngPath, input.png, { contentType: 'image/png' });
  if (pngUpload.error) throw new Error(pngUpload.error.message);
  const psdUpload = await sb.storage.from('flyers').upload(psdPath, pngToPsd(input.png), { contentType: 'image/vnd.adobe.photoshop' });
  if (psdUpload.error) { await sb.storage.from('flyers').remove([pngPath]); throw new Error(psdUpload.error.message); }
  const { error } = await sb.from('marketing_submissions').insert({
    id, design_id: input.designId, version_id: input.versionId, submitted_by: input.userId, sender_email: input.email,
    title: input.title, version_number: input.versionNumber, png_path: pngPath, psd_path: psdPath,
    checks: input.checks, needed_by: input.neededBy, uses: input.uses,
  });
  if (error) { await sb.storage.from('flyers').remove([pngPath, psdPath]); throw new Error(error.message); }
  await sb.from('marketing_audit_events').insert({ submission_id: id, actor_id: input.userId, action: 'submitted' });
  return id;
}