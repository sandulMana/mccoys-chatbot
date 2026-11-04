export async function purgeMarketingSubmission(id: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: row, error } = await supabaseAdmin.from('marketing_submissions').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return;
  // All submission revisions use this submission UUID, including edits uploaded by other teammates.
  const { data: objects, error: listError } = await supabaseAdmin.schema('storage').from('objects').select('name').eq('bucket_id','flyers').like('name', `marketing/%/${id}/%`);
  if (listError) throw new Error(listError.message);
  const paths = (objects ?? []).map((item) => item.name).filter((name): name is string => typeof name === 'string');
  if (paths.length) { const { error: removeError } = await supabaseAdmin.storage.from('flyers').remove(paths); if (removeError) throw new Error(removeError.message); }
  const { error: deleteError } = await supabaseAdmin.from('marketing_submissions').delete().eq('id', id);
  if (deleteError) throw new Error(deleteError.message);
}