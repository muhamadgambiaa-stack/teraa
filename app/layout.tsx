import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "./globals.css";

import { AppShell } from "@/components/AppShell";
import { MobileBottomNav } from "@/components/MobileBottomNav";
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
    icon: [
      {
        url: "/teraa-favicon.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    shortcut: "/favicon.ico",
    apple: "/teraa-favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <div className="min-h-full">
          <AppShell>{children}</AppShell>
        </div>

        <PushNotifications />
        <MobileBottomNav />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
