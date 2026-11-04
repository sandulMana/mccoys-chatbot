import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
export const Route = createFileRoute('/api/public/marketing-cleanup')({ server: { handlers: {
  POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin.from('marketing_submissions').select('id').lte('delete_at', new Date().toISOString()).limit(100);
    if (error) throw new Error(error.message);
    const { purgeMarketingSubmission } = await import('@/lib/marketing-cleanup.server');
    for (const row of data ?? []) await purgeMarketingSubmission(row.id);
    return Response.json({ deleted: data?.length ?? 0 });
  },
} } });