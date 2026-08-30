import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Teraa",
    short_name: "Teraa",
    description: "Buy and sell safely on Teraa.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/branding/teraa-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
