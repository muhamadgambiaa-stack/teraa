import { createBrowserClient } from "@supabase/ssr";

// Client-side Supabase client — safe to use in "use client" components.
// Reads env vars set in .env.local locally, or in your hosting platform's
// environment variable settings in production (e.g. Vercel → Project
// Settings → Environment Variables).
//
// If the env vars are missing, we deliberately do NOT throw here. Several
// "use client" pages (login, signup) call createClient() during render,
// and Next.js prerenders those on the server at build time — throwing here
// would crash the entire production build over a config issue rather than
// failing gracefully at the point someone actually tries to log in. Instead
// we fall back to placeholder values; any real auth call will then fail
// with a clear network/auth error that the calling page already catches
// and displays to the user.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://not-configured.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "not-configured";

  return createBrowserClient(url, key);
}
