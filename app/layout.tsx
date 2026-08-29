import type { Metadata } from "next";

import "./globals.css";

import { MobileBottomNav } from "@/components/MobileBottomNav";

export const metadata: Metadata = {
  title: "Teraa: Buy & sell, safely",
  description:
    "Teraa is The Gambia's marketplace for buying and selling. Discover products from verified sellers and shop with confidence.",
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

        <MobileBottomNav />
      </body>
    </html>
  );
}
