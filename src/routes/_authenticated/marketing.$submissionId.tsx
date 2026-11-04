import { createFileRoute } from '@tanstack/react-router';
import { MarketingDashboard } from '@/components/MarketingDashboard';
export const Route = createFileRoute('/_authenticated/marketing/$submissionId')({
  head: () => ({ meta: [
    { title: "Audit design · McCoy's Marketing" },
    { name: 'description', content: "Review McCoy's design files, brand checks, and team feedback." },
    { property: 'og:title', content: "Audit design · McCoy's Marketing" },
    { property: 'og:description', content: "Review McCoy's design files, brand checks, and team feedback." },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }), component: Page,
});
function Page() { const { submissionId } = Route.useParams(); return <MarketingDashboard designId={submissionId} />; }