"use client";

import { usePathname } from "next/navigation";

import { DesktopSidebar } from "@/components/DesktopSidebar";
import { usesSimpleLayout } from "@/lib/app-routes";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const simpleLayout = usesSimpleLayout(pathname);

  if (simpleLayout) {
    return <div className="min-h-full">{children}</div>;
  }

  return (
    <div className="min-h-full pb-20 sm:pb-0">
      <DesktopSidebar />
      <div className="min-h-full min-w-0 lg:pl-[220px]">{children}</div>
    </div>
  );
}
