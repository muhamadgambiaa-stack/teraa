import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "./globals.css";

import { MobileBottomNav } from "@/components/MobileBottomNav";
import { InstallTeraa } from "@/components/InstallTeraa";
import { PushNotifications } from "@/components/PushNotifications";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.getteraa.com"),
  title: "Teraa: Buy & sell, safely",
  description:
    "Teraa is The Gambia's marketplace for buying and selling. Discover products from verified sellers and shop with confidence.",
  applicationName: "Teraa",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Teraa",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/branding/teraa-icon.svg",
    apple: "/branding/teraa-icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="flex-1 pb-20 sm:pb-0">{children}</div>

        <InstallTeraa />
        <PushNotifications />
        <MobileBottomNav />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
