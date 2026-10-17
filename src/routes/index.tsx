import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "McCoy's Brand Studio" },
      { name: "description", content: "Describe your promo and get an on-brand McCoy's flyer." },
      { property: "og:title", content: "McCoy's Brand Studio" },
      { property: "og:description", content: "Describe your promo and get an on-brand McCoy's flyer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    // OAuth returns here with tokens in the URL hash; let Supabase consume them before redirecting drops the hash.
    await supabase.auth.getSession();
    throw redirect({ to: "/studio" });
  },
});
