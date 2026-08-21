import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client — use in Server Components, Route Handlers,
// and Server Actions. Handles auth cookies so RLS policies know who's asking.
//
// Falls back to placeholder values if env vars are missing, same rationale
// as lib/supabase/client.ts — avoids crashing the whole build/render over a
// config issue. Callers that query data already handle Supabase errors
// gracefully (see app/page.tsx's try/catch → "not connected" banner).
export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://not-configured.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "not-configured";

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore if you have
            // middleware refreshing sessions.
          }
        },
      },
    }
  );
}
