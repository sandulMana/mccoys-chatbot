import { createFileRoute, redirect } from "@tanstack/react-router";

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
  beforeLoad: () => {
    throw redirect({ to: "/studio" });
  },
});
