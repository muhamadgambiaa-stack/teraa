import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teraa: Buy & sell, safely",
  description:
    "Teraa is The Gambia's trusted marketplace. Verified sellers, secure Wave payments, cash on delivery.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
