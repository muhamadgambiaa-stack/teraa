"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Role = "buyer" | "seller" | "admin" | null;

export function HeaderAuthActions() {
  const router = useRouter();

  /*
   * IMPORTANT:
   * Keep one browser Supabase client instead
   * of creating a new client on every render.
   */
  const supabase = useMemo(() => createClient(), []);

  const [role, setRole] = useState<Role>(null);

  const [authenticated, setAuthenticated] = useState(false);

  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadAuth() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (userError || !user) {
          setAuthenticated(false);
          setRole(null);
          setChecked(true);
          return;
        }

        setAuthenticated(true);

        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;

        if (profileError) {
          console.error("Could not load header user profile:", profileError);

          setRole("buyer");
          setChecked(true);
          return;
        }

        const profileRole = profile?.role;

        if (
          profileRole === "admin" ||
          profileRole === "seller" ||
          profileRole === "buyer"
        ) {
          setRole(profileRole);
        } else {
          setRole("buyer");
        }

        setChecked(true);
      } catch (error) {
        console.error("Header authentication check failed:", error);

        if (mounted) {
          setAuthenticated(false);
          setRole(null);
          setChecked(true);
        }
      }
    }

    loadAuth();

    /*
     * Also listen for authentication changes.
     *
     * This keeps the header correct immediately
     * after login/logout without requiring a full
     * browser reload.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (!session?.user) {
        setAuthenticated(false);
        setRole(null);
        setChecked(true);
        return;
      }

      setAuthenticated(true);

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      const nextRole = profile?.role;

      if (
        nextRole === "admin" ||
        nextRole === "seller" ||
        nextRole === "buyer"
      ) {
        setRole(nextRole);
      } else {
        setRole("buyer");
      }

      setChecked(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();

    setAuthenticated(false);
    setRole(null);

    router.replace("/");
    router.refresh();
  }

  /*
   * Don't briefly show "Log in" while we're
   * still checking the user's session.
   */
  if (!checked) {
    return <div className="h-9 w-28" />;
  }

  // LOGGED OUT

  if (!authenticated) {
    return (
      <>
        <Link href="/login" className="hover:underline hidden sm:inline">
          Log in
        </Link>

        <Link
          href="/signup"
          className="rounded-full px-4 py-2 text-white text-sm font-medium whitespace-nowrap"
          style={{
            background: "var(--indigo)",
          }}
        >
          Sign up
        </Link>
      </>
    );
  }

  // LOGGED IN

  return (
    <>
      <Link href="/orders" className="hover:underline hidden sm:inline">
        My orders
      </Link>

      <Link href="/account" className="hover:underline hidden sm:inline">
        Account
      </Link>

      {role === "admin" && (
        <Link
          href="/admin"
          className="rounded-full px-4 py-2 text-white text-sm font-medium whitespace-nowrap"
          style={{
            background: "var(--indigo)",
          }}
        >
          Admin
        </Link>
      )}

      {role === "seller" && (
        <Link
          href="/seller/dashboard"
          className="rounded-full px-4 py-2 text-white text-sm font-medium whitespace-nowrap"
          style={{
            background: "var(--indigo)",
          }}
        >
          Seller dashboard
        </Link>
      )}

      {role === "buyer" && (
        <Link
          href="/signup"
          className="rounded-full px-4 py-2 text-white text-sm font-medium whitespace-nowrap"
          style={{
            background: "var(--indigo)",
          }}
        >
          Sell on Teraa
        </Link>
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="text-gray-500 hover:underline hidden sm:inline"
      >
        Log out
      </button>
    </>
  );
}
