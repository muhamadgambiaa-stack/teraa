"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Role = "buyer" | "seller" | "admin" | null;

export function HeaderAuthActions() {
  const supabase = createClient();
  const router = useRouter();
  const [role, setRole] = useState<Role>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (active) setChecked(true);
        return;
      }
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      if (active) {
        setRole((profile?.role as Role) ?? "buyer");
        setChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  // Avoid a layout flash: render nothing extra until we know the auth
  // state, the logged-out links below are the same as the default markup
  // so there's no visible flicker either way.
  if (!checked || !role) {
    return (
      <>
        <Link href="/login" className="hover:underline hidden sm:inline">
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-full px-4 py-2 text-white text-sm font-medium whitespace-nowrap"
          style={{ background: "var(--indigo)" }}
        >
          Sign up
        </Link>
      </>
    );
  }

  const dashboardLink =
    role === "admin"
      ? { href: "/admin", label: "Admin" }
      : role === "seller"
        ? { href: "/seller/dashboard", label: "Seller dashboard" }
        : null;

  return (
    <>
      <Link href="/orders" className="hover:underline hidden sm:inline">
        My orders
      </Link>
      {dashboardLink && (
        <Link
          href={dashboardLink.href}
          className="rounded-full px-4 py-2 text-white text-sm font-medium whitespace-nowrap"
          style={{ background: "var(--indigo)" }}
        >
          {dashboardLink.label}
        </Link>
      )}
      {!dashboardLink && (
        <Link
          href="/signup"
          className="rounded-full px-4 py-2 text-white text-sm font-medium whitespace-nowrap"
          style={{ background: "var(--indigo)" }}
        >
          Sell on Teraa
        </Link>
      )}
      <button
        onClick={handleLogout}
        className="text-gray-500 hover:underline hidden sm:inline"
      >
        Log out
      </button>
    </>
  );
}
