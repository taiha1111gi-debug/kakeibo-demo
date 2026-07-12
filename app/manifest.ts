import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mellow 家計簿（デモ）",
    short_name: "Mellow",
    description: "支出をそっと自動でまとめる家計簿の公開デモ",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f5f2",
    theme_color: "#23352d",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
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
    ],
  };
}
