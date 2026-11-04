import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { MarketingDashboard } from '@/components/MarketingDashboard';
export const Route = createFileRoute('/_authenticated/marketing/')({
  validateSearch: z.object({ folder: z.enum(['inbox','approved','needs_changes','archived']).catch('inbox') }),
  head: () => ({ meta: [
    { title: "Design review · McCoy's Marketing" },
    { name: 'description', content: "Shared McCoy's marketing inbox, approvals, and design files." },
    { property: 'og:title', content: "Design review · McCoy's Marketing" },
    { property: 'og:description', content: "Shared McCoy's marketing inbox, approvals, and design files." },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Page,
});
function Page() { const { folder } = Route.useSearch(); return <MarketingDashboard key={folder} folder={folder} />; }