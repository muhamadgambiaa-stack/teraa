import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Teraa",
    short_name: "Teraa",
    description:
      "A marketplace for buying and selling in The Gambia.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf4e7",
    theme_color: "#08275f",
    icons: [
      {
        src: "/branding/teraa-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
