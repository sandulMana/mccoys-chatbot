export async function purgeMarketingSubmission(id: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: row, error } = await supabaseAdmin.from('marketing_submissions').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return;
  // All submission revisions use this submission UUID, including edits uploaded by other teammates.
  const paths: string[] = [];
  // Enumerate team folders through the supported Storage API, including edited revisions.
  for (let offset = 0; ; offset += 100) {
    const { data: folders, error: folderError } = await supabaseAdmin.storage.from('flyers').list('marketing', { limit: 100, offset });
    if (folderError) throw new Error(folderError.message);
    for (const folder of folders ?? []) {
      const prefix = `marketing/${folder.name}/${id}`;
      for (let fileOffset = 0; ; fileOffset += 100) {
        const { data: files, error: listError } = await supabaseAdmin.storage.from('flyers').list(prefix, { limit: 100, offset: fileOffset });
        if (listError) throw new Error(listError.message);
        paths.push(...(files ?? []).filter(file => file.id !== null).map(file => `${prefix}/${file.name}`));
        if ((files?.length ?? 0) < 100) break;
      }
    }
    if ((folders?.length ?? 0) < 100) break;
  }
  if (paths.length) { const { error: removeError } = await supabaseAdmin.storage.from('flyers').remove(paths); if (removeError) throw new Error(removeError.message); }
  const { error: deleteError } = await supabaseAdmin.from('marketing_submissions').delete().eq('id', id);
  if (deleteError) throw new Error(deleteError.message);
}