import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase's email confirmation link lands here with a `code` query param.
// That code has to be exchanged for a real session server-side, this is
// what actually sets the auth cookies correctly, a client-side page trying
// to read the session from the URL directly is unreliable (it's why the
// earlier version of this page intermittently hit RLS errors, the insert
// could fire before a real session existed).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const supabase = await createClient();
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const user = data.user;

  // Has their profile already been created? (e.g. they clicked the
  // confirmation link twice)
  const { data: existingProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.redirect(
      `${origin}${existingProfile.role === "seller" ? "/seller/dashboard" : "/"}`
    );
  }

  // First time here after confirming, finish creating the profile using
  // the details stashed as metadata during signup. This now runs with a
  // real, cookie-backed session, so the RLS check (id = auth.uid()) passes.
  const meta = user.user_metadata as {
    full_name?: string;
    phone_number?: string;
    city?: string;
    role?: "buyer" | "seller";
  };

  if (!meta.full_name || !meta.phone_number || !meta.city || !meta.role) {
    return NextResponse.redirect(`${origin}/signup?error=missing_details`);
  }

  const { error: profileError } = await supabase.from("users").insert({
    id: user.id,
    phone_number: meta.phone_number,
    full_name: meta.full_name,
    city: meta.city,
    role: meta.role,
  });

  if (profileError) {
    return NextResponse.redirect(`${origin}/signup?error=profile_failed`);
  }

  if (meta.role === "seller") {
    await supabase.from("sellers").insert({
      id: user.id,
      business_name: meta.full_name,
    });
    return NextResponse.redirect(`${origin}/seller/dashboard`);
  }

  return NextResponse.redirect(`${origin}/`);
}