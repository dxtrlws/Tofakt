import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Watchlog",
    short_name: "Watchlog",
    description: "tofa plays, synced to Trakt, with timestamps you can trust.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#03141C",
    theme_color: "#03141C",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
