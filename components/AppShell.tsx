"use client";

import { usePathname } from "next/navigation";

import { DesktopSidebar } from "@/components/DesktopSidebar";

const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/check-email",
  "/onboarding",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const usesSimpleLayout = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (usesSimpleLayout) {
    return <div className="min-h-full">{children}</div>;
  }

  return (
    <div className="min-h-full">
      <DesktopSidebar />
      <div className="min-h-full min-w-0 lg:pl-[220px]">{children}</div>
    </div>
  );
}
